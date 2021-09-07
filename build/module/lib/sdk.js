import axios from 'axios';
import * as Cookies from 'js-cookie';
import * as qs from 'qs';
import { reactive } from 'vue';
import StrapiHTTPError from './StrapiHTTPError';
export default class Strapi {
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
        this.state = reactive({
            user: null,
        });
        this.axios = axios.create({
            baseURL,
            paramsSerializer: qs.stringify,
            ...requestConfig,
        });
        this.storeConfig = {
            cookie: {
                key: 'jwt',
                options: {
                    path: '/',
                },
            },
            localStorage: {
                key: 'jwt',
            },
            ...storeConfig,
        };
        if (this.isBrowser()) {
            let existingToken;
            if (this.storeConfig.cookie) {
                existingToken = Cookies.get(this.storeConfig.cookie.key);
            } else if (this.storeConfig.localStorage) {
                existingToken = JSON.parse(
                    window.localStorage.getItem(
                        this.storeConfig.localStorage.key,
                    ),
                );
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
        this.state['user'] = user;
    }
    /**
     * Axios request
     * @param method Request method
     * @param url Server URL
     * @param requestConfig Custom Axios config
     */
    async request(method, url, requestConfig) {
        try {
            const response = await this.axios.request({
                method,
                url,
                ...requestConfig,
            });
            return response.data;
        } catch (error) {
            if (error.response) {
                throw new StrapiHTTPError(error);
            } else {
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
        const authentication = await this.request(
            'post',
            '/auth/local/register',
            {
                data: e,
            },
        );
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
        const authentication = await this.request(
            'post',
            '/auth/reset-password',
            {
                data: e,
            },
        );
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
        } catch (e) {
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
        const authentication = await this.request(
            'get',
            `/auth/${provider}/callback`,
            {
                params,
            },
        );
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
        return this.request(
            'get',
            `/upload/search/${decodeURIComponent(query)}`,
        );
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
        return this.request('post', '/upload', {
            data,
            ...requestConfig,
        });
    }
    /**
     * Set token on Axios configuration
     * @param token Retrieved by register or login
     */
    setToken(token, comesFromStorage) {
        this.axios.defaults.headers.common.Authorization = 'Bearer ' + token;
        if (this.isBrowser() && !comesFromStorage) {
            if (this.storeConfig.localStorage) {
                window.localStorage.setItem(
                    this.storeConfig.localStorage.key,
                    JSON.stringify(token),
                );
            }
            if (this.storeConfig.cookie) {
                Cookies.set(
                    this.storeConfig.cookie.key,
                    token,
                    this.storeConfig.cookie.options,
                );
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
                window.localStorage.removeItem(
                    this.storeConfig.localStorage.key,
                );
            }
            if (this.storeConfig.cookie) {
                Cookies.remove(
                    this.storeConfig.cookie.key,
                    this.storeConfig.cookie.options,
                );
            }
        }
    }
    getToken() {
        let token;
        if (this.isBrowser()) {
            if (this.storeConfig.cookie) {
                token = Cookies.get(this.storeConfig.cookie.key);
            } else if (this.storeConfig.localStorage) {
                token = JSON.parse(
                    window.localStorage.getItem(
                        this.storeConfig.localStorage.key,
                    ),
                );
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
        } else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc3JjL2xpYi9zZGsudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUtOLE1BQU0sT0FBTyxDQUFDO0FBQ2YsT0FBTyxLQUFLLE9BQU8sTUFBTSxXQUFXLENBQUM7QUFDckMsT0FBTyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUM7QUFDekIsT0FBTyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBZXRCLE1BQU0sQ0FBQyxPQUFPLE9BQU8sTUFBTTtJQWV6Qjs7OztPQUlHO0lBQ0gsWUFBWSxPQUFzQjtRQUNoQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsSUFBSSx1QkFBdUIsQ0FBQztRQUM1RCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQztRQUNqRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQztRQUM3QyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUM7WUFDMUIsSUFBSSxFQUFFLElBQUk7U0FDWCxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7WUFDeEIsT0FBTztZQUNQLGdCQUFnQixFQUFFLEVBQUUsQ0FBQyxTQUFTO1lBQzlCLEdBQUcsYUFBYTtTQUNqQixDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsV0FBVyxHQUFHO1lBQ2pCLE1BQU0sRUFBRTtnQkFDTixHQUFHLEVBQUUsS0FBSztnQkFDVixPQUFPLEVBQUU7b0JBQ1AsSUFBSSxFQUFFLEdBQUc7aUJBQ1Y7YUFDRjtZQUNELFlBQVksRUFBRTtnQkFDWixHQUFHLEVBQUUsS0FBSzthQUNYO1lBQ0QsR0FBRyxXQUFXO1NBQ2YsQ0FBQztRQUVGLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUFFO1lBQ3BCLElBQUksYUFBYSxDQUFDO1lBQ2xCLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7Z0JBQzNCLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQzFEO2lCQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUU7Z0JBQ3hDLGFBQWEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUN4QixNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FDekIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUN4QixDQUNaLENBQUM7YUFDSDtZQUNELElBQUksYUFBYSxFQUFFO2dCQUNqQixJQUFJLENBQUMsUUFBUSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsQ0FBQzthQUNwQztTQUNGO0lBQ0gsQ0FBQztJQTVERCxJQUFJLElBQUk7UUFDTixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0lBQ3pCLENBQUM7SUFFRCxJQUFJLElBQUksQ0FBQyxJQUFJO1FBQ1gsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBd0REOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLE9BQU8sQ0FDbEIsTUFBYyxFQUNkLEdBQVcsRUFDWCxhQUFrQztRQUVsQyxJQUFJO1lBQ0YsTUFBTSxRQUFRLEdBQWtCLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUM7Z0JBQ3ZELE1BQU07Z0JBQ04sR0FBRztnQkFDSCxHQUFHLGFBQWE7YUFDakIsQ0FBQyxDQUFDO1lBQ0gsT0FBTyxRQUFRLENBQUMsSUFBSSxDQUFDO1NBQ3RCO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDZCxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUU7Z0JBQ2xCLE1BQU0sSUFBSSxLQUFLLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDOUM7aUJBQU07Z0JBQ0wsTUFBTSxLQUFLLENBQUM7YUFDYjtTQUNGO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNJLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBeUI7UUFDN0MsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sY0FBYyxHQUFtQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQ3ZELE1BQU0sRUFDTixzQkFBc0IsRUFDdEI7WUFDRSxJQUFJLEVBQUUsQ0FBQztTQUNSLENBQ0YsQ0FBQztRQUNGLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsT0FBTyxjQUFjLENBQUM7SUFDeEIsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0ksS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFrQjtRQUNuQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsTUFBTSxjQUFjLEdBQW1CLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FDdkQsTUFBTSxFQUNOLGFBQWEsRUFDYjtZQUNFLElBQUksRUFBRSxDQUFDO1NBQ1IsQ0FDRixDQUFDO1FBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQWtCO1FBQzVDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNsQixNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLHVCQUF1QixFQUFFO1lBQ2xELElBQUksRUFBRSxDQUFDO1NBQ1IsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVNLE1BQU07UUFDWCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSxLQUFLLENBQUMsYUFBYSxDQUN4QixDQUEwQjtRQUUxQixJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsTUFBTSxjQUFjLEdBQW1CLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FDdkQsTUFBTSxFQUNOLHNCQUFzQixFQUN0QjtZQUNFLElBQUksRUFBRSxDQUFDO1NBQ1IsQ0FDRixDQUFDO1FBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN4QyxPQUFPLGNBQWMsQ0FBQztJQUN4QixDQUFDO0lBRUQ7OztPQUdHO0lBRUksS0FBSyxDQUFDLFNBQVM7UUFDcEIsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQzdCLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixPQUFPLElBQVcsQ0FBQztTQUNwQjtRQUVELElBQUk7WUFDRixNQUFNLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hELE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUMxQjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1NBQ25CO1FBRUQsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFDTSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQVM7UUFDNUIsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbkIsQ0FBQztJQUVEOzs7T0FHRztJQUNJLDRCQUE0QixDQUFDLFFBQWtCO1FBQ3BELE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLFlBQVksUUFBUSxFQUFFLENBQUM7SUFDOUQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQUMsb0JBQW9CLENBQy9CLFFBQWtCLEVBQ2xCLE1BQXNCO1FBRXRCLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNsQix5QkFBeUI7UUFDekIsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUU7WUFDcEIsTUFBTSxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUU7Z0JBQ3hDLGlCQUFpQixFQUFFLElBQUk7YUFDeEIsQ0FBQyxDQUFDO1NBQ0o7UUFDRCxNQUFNLGNBQWMsR0FBbUIsTUFBTSxJQUFJLENBQUMsT0FBTyxDQUN2RCxLQUFLLEVBQ0wsU0FBUyxRQUFRLFdBQVcsRUFDNUI7WUFDRSxNQUFNO1NBQ1AsQ0FDRixDQUFDO1FBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEMsT0FBTyxjQUFjLENBQUM7SUFDeEIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxJQUFJLENBQ1QsTUFBYyxFQUNkLE1BQXFDO1FBRXJDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxNQUFNLEVBQUUsRUFBRTtZQUN2QyxNQUFNO1NBQ1AsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxLQUFLLENBQ1YsTUFBYyxFQUNkLE1BQXFDO1FBRXJDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxNQUFNLFFBQVEsRUFBRTtZQUM3QyxNQUFNO1NBQ1AsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxRQUFRLENBQUMsTUFBYyxFQUFFLEVBQVU7UUFDeEMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLE1BQU0sSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTSxDQUNYLE1BQWMsRUFDZCxJQUFnQztRQUVoQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLElBQUksTUFBTSxFQUFFLEVBQUU7WUFDeEMsSUFBSTtTQUNMLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNJLE1BQU0sQ0FDWCxNQUFjLEVBQ2QsRUFBVSxFQUNWLElBQWdDO1FBRWhDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxNQUFNLElBQUksRUFBRSxFQUFFLEVBQUU7WUFDN0MsSUFBSTtTQUNMLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksTUFBTSxDQUFDLE1BQWMsRUFBRSxFQUFVO1FBQ3RDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsSUFBSSxNQUFNLElBQUksRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksV0FBVyxDQUFDLEtBQWE7UUFDOUIsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxrQkFBa0Isa0JBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQzVFLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksU0FBUyxDQUFDLE1BQXFDO1FBQ3BELE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsZUFBZSxFQUFFO1lBQzFDLE1BQU07U0FDUCxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0Q7OztPQUdHO0lBRUksT0FBTyxDQUFDLEtBQXlCO1FBQ3RDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsVUFBVSxFQUFFO1lBQ3RDLElBQUksRUFBRSxLQUFLO1NBQ1osQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNJLFFBQVEsQ0FBQyxFQUFVO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0F3Qkc7SUFDSSxNQUFNLENBQ1gsSUFBYyxFQUNkLGFBQWtDO1FBRWxDLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFO1lBQ3JDLElBQUk7WUFDSixHQUFHLGFBQWE7U0FDakIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNEOzs7T0FHRztJQUNJLFFBQVEsQ0FBQyxLQUFhLEVBQUUsZ0JBQTBCO1FBQ3ZELElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsYUFBYSxHQUFHLFNBQVMsR0FBRyxLQUFLLENBQUM7UUFDckUsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtZQUN6QyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFO2dCQUNqQyxNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FDekIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsR0FBRyxFQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUN0QixDQUFDO2FBQ0g7WUFDRCxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFO2dCQUMzQixPQUFPLENBQUMsR0FBRyxDQUNULElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFDM0IsS0FBSyxFQUNMLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FDaEMsQ0FBQzthQUNIO1NBQ0Y7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSSxVQUFVO1FBQ2YsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztRQUN4RCxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsRUFBRTtZQUNwQixJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFO2dCQUNqQyxNQUFNLENBQUMsWUFBWSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUNuRTtZQUNELElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7Z0JBQzNCLE9BQU8sQ0FBQyxNQUFNLENBQ1osSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUMzQixJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQ2hDLENBQUM7YUFDSDtTQUNGO0lBQ0gsQ0FBQztJQUVNLFFBQVE7UUFDYixJQUFJLEtBQUssQ0FBQztRQUNWLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUFFO1lBQ3BCLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7Z0JBQzNCLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ2xEO2lCQUFNLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUU7Z0JBQ3hDLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUNoQixNQUFNLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FDekIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUN4QixDQUNaLENBQUM7YUFDSDtTQUNGO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDO0lBQ08sU0FBUyxDQUFDLEdBQXdCO1FBQ3hDLElBQUksQ0FBQyxHQUFHLEVBQUU7WUFDUixHQUFHLEdBQUcsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQ3ZCO1FBQ0QsSUFBSSxHQUFHLEVBQUU7WUFDUCxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ3BCO2FBQU07WUFDTCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7U0FDbkI7UUFDRCxPQUFPLEdBQUcsQ0FBQztJQUNiLENBQUM7SUFFRDs7T0FFRztJQUNLLFNBQVM7UUFDZixPQUFPLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQztJQUN2QyxDQUFDO0NBQ0YifQ==
