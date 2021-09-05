import { AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import { Authentication, Provider, ProviderToken, StoreConfig, StrapiEmailData, StrapiGraphQLQuery, StrapiLoginData, StrapiOptions, StrapiRegistrationData, StrapiResetPasswordData, StrapiUser } from './../types/types';
export default class Strapi {
    get user(): StrapiUser;
    set user(user: StrapiUser);
    axios: AxiosInstance;
    storeConfig: StoreConfig;
    options: StrapiOptions;
    private state;
    /**
     * Default constructor.
     * @param options.url Your Strapi host.
     * @param options.requestConfig Extend Axios configuration.
     */
    constructor(options: StrapiOptions);
    /**
     * Axios request
     * @param method Request method
     * @param url Server URL
     * @param requestConfig Custom Axios config
     */
    request(method: Method, url: string, requestConfig?: AxiosRequestConfig): Promise<any>;
    /**
     * Register a new user.
     * @param username
     * @param email
     * @param password
     * @returns Authentication User token and profile
     */
    register(e: StrapiRegistrationData): Promise<Authentication>;
    /**
     * Login by getting an authentication token.
     * @param identifier Can either be an email or a username.
     * @param password
     * @returns Authentication User token and profile
     */
    login(e: StrapiLoginData): Promise<Authentication>;
    /**
     * Sends an email to a user with the link of your reset password page.
     * This link contains an URL param code which is required to reset user password.
     * Received link url format https://my-domain.com/rest-password?code=privateCode.
     * @param email
     */
    forgotPassword(e: StrapiEmailData): Promise<void>;
    logout(): void;
    /**
     * Reset the user password.
     * @param code Is the url params received from the email link (see forgot password).
     * @param password
     * @param passwordConfirmation
     */
    resetPassword(e: StrapiResetPasswordData): Promise<Authentication>;
    /**
     * Fetch the user data . user.me
     *
     */
    fetchUser(): Promise<StrapiUser>;
    setUser(user: any): Promise<void>;
    /**
     * Retrieve the connect provider URL
     * @param provider
     */
    getProviderAuthenticationUrl(provider: Provider): string;
    /**
     * Authenticate the user with the token present on the URL (for browser) or in `params` (on Node.js)
     * @param provider
     * @param params
     */
    authenticateProvider(provider: Provider, params?: ProviderToken): Promise<Authentication>;
    /**
     * List entries
     * @param entity
     * @param params Filter and order queries.
     */
    find(entity: string, params?: AxiosRequestConfig['params']): Promise<object[]>;
    /**
     * Get the total count of entries with the provided criteria
     * @param entity
     * @param params Filter and order queries.
     */
    count(entity: string, params?: AxiosRequestConfig['params']): Promise<object[]>;
    /**
     * Get a specific entry
     * @param entity Type of entry pluralized
     * @param id ID of entry
     */
    findById(entity: string, id: string): Promise<object>;
    /**
     * Create data
     * @param entity Type of entry pluralized
     * @param data New entry
     */
    create(entity: string, data: AxiosRequestConfig['data']): Promise<object>;
    /**
     * Update data
     * @param entity Type of entry pluralized
     * @param id ID of entry
     * @param data
     */
    update(entity: string, id: string, data: AxiosRequestConfig['data']): Promise<object>;
    /**
     * Delete an entry
     * @param entity Type of entry pluralized
     * @param id ID of entry
     */
    delete(entity: string, id: string): Promise<object>;
    /**
     * Search for files
     * @param query Keywords
     */
    searchFiles(query: string): Promise<object[]>;
    /**
     * Get files
     * @param params Filter and order queries
     * @returns Object[] Files data
     */
    findFiles(params?: AxiosRequestConfig['params']): Promise<object[]>;
    /**
     * qyery data graphql
     * @param query query data
     */
    graphql(query: StrapiGraphQLQuery): Promise<object[]>;
    /**
     * Get file
     * @param id ID of entry
     */
    findFile(id: string): Promise<object>;
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
    upload(data: FormData, requestConfig?: AxiosRequestConfig): Promise<object>;
    /**
     * Set token on Axios configuration
     * @param token Retrieved by register or login
     */
    setToken(token: string, comesFromStorage?: boolean): void;
    /**
     * Remove token from Axios configuration
     */
    clearToken(): void;
    getToken(): string;
    private syncToken;
    /**
     * Check if it runs on browser
     */
    private isBrowser;
}
