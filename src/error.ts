export enum HTTPStatusCode {
  BAD_REQUEST = 400,
  NOT_FOUND = 404,
  NOT_ACCEPTABLE = 406,
  INTERNAL_SERVER_ERROR = 500,
}

export class HTTPError extends Error {
  public readonly status: HTTPStatusCode

  constructor(
    message: string,
    status: HTTPStatusCode = HTTPStatusCode.INTERNAL_SERVER_ERROR
  ) {
    super(message)
    this.name = "HTTPError"
    this.status = status
    Error.captureStackTrace(this)
  }
}
