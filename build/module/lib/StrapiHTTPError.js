export default class StrapiHTTPError {
    constructor(err) {
        const {
            response: {
                data: { message: msg },
            },
        } = err;

        let message;
        if (Array.isArray(msg)) {
            message = msg[0].messages[0].message;
        } else if (typeof msg === 'object' && msg !== null) {
            message = msg.message;
        } else {
            message = msg;
        }

        this.name = 'StrapiHTTPError';
        this.message = message;
        this.original = err.response.data;
    }
}
