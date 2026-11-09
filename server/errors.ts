/** The thing asked for doesn't exist. Sent as 404. */
export class NotFoundError extends Error {}

/** The request can't be carried out as sent. Sent as 400. */
export class InvalidRequestError extends Error {}
