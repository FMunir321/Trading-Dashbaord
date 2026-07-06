class HttpError extends Error {
  constructor(statusCode, message, code = 'HTTP_ERROR') {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const sendError = (res, statusCode, message, code = 'HTTP_ERROR') =>
  res.status(statusCode).json({ error: message, code });

module.exports = {
  HttpError,
  sendError,
};
