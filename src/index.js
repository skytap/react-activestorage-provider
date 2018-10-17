/**
 * This component handles the direct upload of a file to an ActiveStorage
 * service and calls render props with arguments that indicate that upload’s
 * progress.
 *
 * @providesModule ActiveStorageProvider
 * @flow
 */

import * as React from 'react'

import csrfHeader from './csrfHeader'
import Upload from './Upload'

import type { ActiveStorageFileUpload, Endpoint, RenderProps } from './types'
export type { ActiveStorageFileUpload, Endpoint, RenderProps } from './types'

type Props = {
  endpoint: Endpoint,
  token?: string,
  multiple?: boolean,
  onBeforeBlobRequest?: ({
    id: string,
    file: File,
    xhr: XMLHttpRequest,
  }) => mixed,
  onBeforeStorageRequest?: ({
    id: string,
    file: File,
    xhr: XMLHttpRequest,
  }) => mixed,
  onSubmit: Object => mixed,
  onError?: Response => mixed,
  render: RenderProps => React.Node,
}
type State = {
  uploading: boolean,
  files: { [string]: ActiveStorageFileUpload },
}
class ActiveStorageProvider extends React.Component<Props, State> {
  state = {
    uploading: false,
    files: {},
  }

  handleChooseFiles = (files: FileList | File[]) => {
    if (this.state.uploading) return
    if (files.length === 0) return

    return new Promise<void>(resolve =>
      this.setState({ uploading: true }, () => {
        Promise.all([...files].map(file => this._upload(file))).then(ids => {
          this._hitEndpointWithSignedIds(ids)
            .then(data => this.props.onSubmit(data))
            .catch(e => this.props.onError && this.props.onError(e))
            .then(() => this.setState({ files: {}, uploading: false }, resolve))
        })
      })
    )
  }

  handleChangeFile = (fileUpload: { [string]: ActiveStorageFileUpload }) =>
    this.setState(({ files }) => ({ files: { ...files, ...fileUpload } }))

  render() {
    const { files } = this.state
    return this.props.render({
      handleUpload: this.handleChooseFiles,
      ready: !this.state.uploading,
      uploads: Object.keys(files).map(key => files[key]),
    })
  }

  _upload(file: File): Promise<string> {
    const { endpoint, onBeforeBlobRequest, onBeforeStorageRequest } = this.props

    return new Upload(file, {
      endpoint,
      onBeforeBlobRequest,
      onBeforeStorageRequest,
      onChangeFile: this.handleChangeFile,
    }).start()
  }

  _hitEndpointWithSignedIds(signedIds: string[]): Promise<Object> {
    const { endpoint, multiple, token } = this.props
    const { path, method, attribute, model } = endpoint

    const body = {
      [model.toLowerCase()]: {
        [attribute]: multiple ? signedIds : signedIds[0],
      },
    }

    return fetch(path, {
      credentials: 'same-origin',
      method,
      body: JSON.stringify(body),
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(token ? { Authorization: token } : {}),
        ...csrfHeader(),
      }),
    })
      .then(r => {
        if (!r.ok) throw r
        return r
      })
      .then(r => r.json())
  }
}

export default ActiveStorageProvider
