"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const Cookies = __importStar(require("js-cookie"));
const qs = __importStar(require("qs"));
const vue_1 = __importDefault(require("vue"));
class Strapi {
    /**
     * Default constructor.
     * @param options.url Your Strapi host.
     * @param options.requestConfig Extend Axios configuration.
     */
    constructor(options) {
        this.options = options;
        const baseURL = this.options.url || 'http://localhost:1337';
        const requestConfig = this.options.requestConfig;
        const storeConfig = this.options.storeConfig;
        this.state = vue_1.default.observable({
            user: null,
        });
        this.axios = axios_1.default.create(Object.assign({ baseURL, paramsSerializer: qs.stringify }, requestConfig));
        this.storeConfig = Object.assign({ cookie: {
                key: 'jwt',
                options: {
                    path: '/',
                },
            }, localStorage: {
                key: 'jwt',
            } }, storeConfig);
        if (this.isBrowser()) {
            let existingToken;
            if (this.storeConfig.cookie) {
                existingToken = Cookies.get(this.storeConfig.cookie.key);
            }
            else if (this.storeConfig.localStorage) {
                existingToken = JSON.parse(window.localStorage.getItem(this.storeConfig.localStorage.key));
            }
            if (existingToken) {
                this.setToken(existingToken, true);
            }
        }
    }
    get user() {
        return this.state.user;
    }
    set user(user) {
        vue_1.default.set(this.state, 'user', user);
    }
    /**
     * Axios request
     * @param method Request method
     * @param url Server URL
     * @param requestConfig Custom Axios config
     */
    async request(method, url, requestConfig) {
        try {
            const response = await this.axios.request(Object.assign({ method,
                url }, requestConfig));
            return response.data;
        }
        catch (error) {
            if (error.response) {
                throw new Error(error.response.data.message);
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Register a new user.
     * @param username
     * @param email
     * @param password
     * @returns Authentication User token and profile
     */
    async register(e) {
        this.clearToken();
        const authentication = await this.request('post', '/auth/local/register', {
            data: e,
        });
        this.setToken(authentication.jwt);
        await this.setUser(authentication.user);
        return authentication;
    }
    /**
     * Login by getting an authentication token.
     * @param identifier Can either be an email or a username.
     * @param password
     * @returns Authentication User token and profile
     */
    async login(e) {
        this.clearToken();
        const authentication = await this.request('post', '/auth/local', {
            data: e,
        });
        this.setToken(authentication.jwt);
        await this.setUser(authentication.user);
        return authentication;
    }
    /**
     * Sends an email to a user with the link of your reset password page.
     * This link contains an URL param code which is required to reset user password.
     * Received link url format https://my-domain.com/rest-password?code=privateCode.
     * @param email
     */
    async forgotPassword(e) {
        this.clearToken();
        await this.request('post', '/auth/forgot-password', {
            data: e,
        });
    }
    logout() {
        this.clearToken();
        this.setUser(null);
    }
    /**
     * Reset the user password.
     * @param code Is the url params received from the email link (see forgot password).
     * @param password
     * @param passwordConfirmation
     */
    async resetPassword(e) {
        this.clearToken();
        const authentication = await this.request('post', '/auth/reset-password', {
            data: e,
        });
        this.setToken(authentication.jwt);
        await this.setUser(authentication.user);
        return authentication;
    }
    /**
     * Fetch the user data . user.me
     *
     */
    async fetchUser() {
        const jwt = this.syncToken();
        if (!jwt) {
            return null;
        }
        try {
            const user = await this.findById('users', 'me');
            await this.setUser(user);
        }
        catch (e) {
            this.clearToken();
        }
        return this.user;
    }
    async setUser(user) {
        this.user = user;
    }
    /**
     * Retrieve the connect provider URL
     * @param provider
     */
    getProviderAuthenticationUrl(provider) {
        return `${this.axios.defaults.baseURL}/connect/${provider}`;
    }
    /**
     * Authenticate the user with the token present on the URL (for browser) or in `params` (on Node.js)
     * @param provider
     * @param params
     */
    async authenticateProvider(provider, params) {
        this.clearToken();
        // Handling browser query
        if (this.isBrowser()) {
            params = qs.parse(window.location.search, {
                ignoreQueryPrefix: true,
            });
        }
        const authentication = await this.request('get', `/auth/${provider}/callback`, {
            params,
        });
        this.setToken(authentication.jwt);
        return authentication;
    }
    /**
     * List entries
     * @param entity
     * @param params Filter and order queries.
     */
    find(entity, params) {
        return this.request('get', `/${entity}`, {
            params,
        });
    }
    /**
     * Get the total count of entries with the provided criteria
     * @param entity
     * @param params Filter and order queries.
     */
    count(entity, params) {
        return this.request('get', `/${entity}/count`, {
            params,
        });
    }
    /**
     * Get a specific entry
     * @param entity Type of entry pluralized
     * @param id ID of entry
     */
    findById(entity, id) {
        return this.request('get', `/${entity}/${id}`);
    }
    /**
     * Create data
     * @param entity Type of entry pluralized
     * @param data New entry
     */
    create(entity, data) {
        return this.request('post', `/${entity}`, {
            data,
        });
    }
    /**
     * Update data
     * @param entity Type of entry pluralized
     * @param id ID of entry
     * @param data
     */
    update(entity, id, data) {
        return this.request('put', `/${entity}/${id}`, {
            data,
        });
    }
    /**
     * Delete an entry
     * @param entity Type of entry pluralized
     * @param id ID of entry
     */
    delete(entity, id) {
        return this.request('delete', `/${entity}/${id}`);
    }
    /**
     * Search for files
     * @param query Keywords
     */
    searchFiles(query) {
        return this.request('get', `/upload/search/${decodeURIComponent(query)}`);
    }
    /**
     * Get files
     * @param params Filter and order queries
     * @returns Object[] Files data
     */
    findFiles(params) {
        return this.request('get', '/upload/files', {
            params,
        });
    }
    /**
     * qyery data graphql
     * @param query query data
     */
    graphql(query) {
        return this.request('post', `/graphql`, {
            data: query,
        });
    }
    /**
     * Get file
     * @param id ID of entry
     */
    findFile(id) {
        return this.request('get', `/upload/files/${id}`);
    }
    /**
     * Upload files
     *
     * ### Browser example
     * ```js
     * const form = new FormData();
     * form.append('files', fileInputElement.files[0], 'file-name.ext');
     * form.append('files', fileInputElement.files[1], 'file-2-name.ext');
     * const files = await strapi.upload(form);
     * ```
     *
     * ### Node.js example
     * ```js
     * const FormData = require('form-data');
     * const fs = require('fs');
     * const form = new FormData();
     * form.append('files', fs.createReadStream('./file-name.ext'), 'file-name.ext');
     * const files = await strapi.upload(form, {
     *   headers: form.getHeaders()
     * });
     * ```
     *
     * @param data FormData
     * @param requestConfig
     */
    upload(data, requestConfig) {
        return this.request('post', '/upload', Object.assign({ data }, requestConfig));
    }
    /**
     * Set token on Axios configuration
     * @param token Retrieved by register or login
     */
    setToken(token, comesFromStorage) {
        this.axios.defaults.headers.common.Authorization = 'Bearer ' + token;
        if (this.isBrowser() && !comesFromStorage) {
            if (this.storeConfig.localStorage) {
                window.localStorage.setItem(this.storeConfig.localStorage.key, JSON.stringify(token));
            }
            if (this.storeConfig.cookie) {
                Cookies.set(this.storeConfig.cookie.key, token, this.storeConfig.cookie.options);
            }
        }
    }
    /**
     * Remove token from Axios configuration
     */
    clearToken() {
        delete this.axios.defaults.headers.common.Authorization;
        if (this.isBrowser()) {
            if (this.storeConfig.localStorage) {
                window.localStorage.removeItem(this.storeConfig.localStorage.key);
            }
            if (this.storeConfig.cookie) {
                Cookies.remove(this.storeConfig.cookie.key, this.storeConfig.cookie.options);
            }
        }
    }
    getToken() {
        let token;
        if (this.isBrowser()) {
            if (this.storeConfig.cookie) {
                token = Cookies.get(this.storeConfig.cookie.key);
            }
            else if (this.storeConfig.localStorage) {
                token = JSON.parse(window.localStorage.getItem(this.storeConfig.localStorage.key));
            }
        }
        return token;
    }
    syncToken(jwt) {
        if (!jwt) {
            jwt = this.getToken();
        }
        if (jwt) {
            this.setToken(jwt);
        }
        else {
            this.clearToken();
        }
        return jwt;
    }
    /**
     * Check if it runs on browser
     */
    isBrowser() {
        return typeof window !== 'undefined';
    }
}
exports.default = Strapi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9zZGsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsa0RBS2U7QUFDZixtREFBcUM7QUFDckMsdUNBQXlCO0FBQ3pCLDhDQUFzQjtBQWV0QixNQUFxQixNQUFNO0lBZXpCOzs7O09BSUc7SUFDSCxZQUFZLE9BQXNCO1FBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxJQUFJLHVCQUF1QixDQUFDO1FBQzVELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBQ2pELE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO1FBQzdDLElBQUksQ0FBQyxLQUFLLEdBQUcsYUFBRyxDQUFDLFVBQVUsQ0FBQztZQUMxQixJQUFJLEVBQUUsSUFBSTtTQUNYLENBQUMsQ0FBQztRQUNILElBQUksQ0FBQyxLQUFLLEdBQUcsZUFBSyxDQUFDLE1BQU0saUJBQ3ZCLE9BQU8sRUFDUCxnQkFBZ0IsRUFBRSxFQUFFLENBQUMsU0FBUyxJQUMzQixhQUFhLEVBQ2hCLENBQUM7UUFDSCxJQUFJLENBQUMsV0FBVyxtQkFDZCxNQUFNLEVBQUU7Z0JBQ04sR0FBRyxFQUFFLEtBQUs7Z0JBQ1YsT0FBTyxFQUFFO29CQUNQLElBQUksRUFBRSxHQUFHO2lCQUNWO2FBQ0YsRUFDRCxZQUFZLEVBQUU7Z0JBQ1osR0FBRyxFQUFFLEtBQUs7YUFDWCxJQUNFLFdBQVcsQ0FDZixDQUFDO1FBRUYsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUU7WUFDcEIsSUFBSSxhQUFhLENBQUM7WUFDbEIsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtnQkFDM0IsYUFBYSxHQUFHLE9BQU8s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