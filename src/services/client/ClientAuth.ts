import moment = require('moment-timezone');
import axios, {
  AxiosRequestConfig,
  AxiosInstance,
} from 'axios';
import fs from 'fs';
import path from 'path';

import { IWorkplaceListApiResponse } from '../../interfaces/api/IWorkplaceListApiResponse';
import { IWorkplaceCapabilitiesApiResponse } from '../../interfaces/api/IWorkplaceCapabilitiesApiResponse';

interface TokenData {
  access_token: string;
  expire_at: number;
}

export class ClientApi {
  private static instance: ClientApi;
  private requestAxiosInstance: AxiosInstance;
  private token: string;
  private expire_at: number;
  private tokenFilePath: string;

  constructor() {
    this.requestAxiosInstance = axios.create({
      baseURL: process.env.WEBEX_API_URL,
    });
    this.tokenFilePath = path.resolve(process.cwd(), 'webex_token.json');
    this.loadTokenFromFile();
  }

  public static getInstance(): ClientApi {
    if (!ClientApi.instance) {
      ClientApi.instance = new ClientApi();
    }
    return ClientApi.instance;
  }

  private loadTokenFromFile() {
    if (fs.existsSync(this.tokenFilePath)) {
      try {
        const tokenData: TokenData = JSON.parse(
          fs.readFileSync(this.tokenFilePath, 'utf-8')
        );
        this.token = tokenData.access_token;
        this.expire_at = tokenData.expire_at;
        console.log('Token loaded from file');
      } catch (error) {
        console.error('Error reading token file:', error);
      }
    }
  }

  private saveTokenToFile() {
    const tokenData: TokenData = {
      access_token: this.token,
      expire_at: this.expire_at,
    };
    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokenData), 'utf-8');
    } catch (error) {
      console.error('Error writing token file:', error);
    }
  }

  async refreshToken(): Promise<string> {
    console.log('Refreshing token ...');
    const data = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.WEBEX_CLIENT_ID,
      client_secret: process.env.WEBEX_CLIENT_SECRET,
      refresh_token: process.env.WEBEX_REFRESH_TOKEN,
    });

    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    try {
      const response = await this.requestAxiosInstance.post(
        '/access_token',
        data,
        config
      );
      this.expire_at = new Date().getTime() + response.data.expires_in * 1000;
      this.token = response.data.access_token;
      this.saveTokenToFile();
      console.log('Refreshing token ... Done!');
      return this.token;
    } catch (error) {
      console.error('Error fetching token:', error);
      throw new Error('Failed to authenticate');
    }
  }

  async ensureTokenValid() {
    const now = new Date().getTime();
    if (!this.token || now >= this.expire_at) {
      await this.refreshToken();
    }
  }

  async getWorkplaces(): Promise<IWorkplaceListApiResponse> {
    await this.ensureTokenValid();
    const config: AxiosRequestConfig = {
      headers: {
        Authorization: 'Bearer ' + this.token,
      },
    };
    try {
      const response = await this.requestAxiosInstance.get(`/workspaces`, config);
      return response.data;
    } catch (e) {
      console.error(e);
    }
  }

  async getWorkplaceCapabilities(
    workplaceId: string
  ): Promise<IWorkplaceCapabilitiesApiResponse> {
    await this.ensureTokenValid();
    const config: AxiosRequestConfig = {
      headers: {
        Authorization: 'Bearer ' + this.token,
      },
    };
    try {
      const response = await this.requestAxiosInstance.get(
        `/workspaces/${workplaceId}/capabilities`,
        config
      );
      return response.data;
    } catch (e) {
      console.error(e);
    }
  }

  async getWorkplaceMetrics(
    workspaceId: string,
    metricName: string,
    aggregation: string = 'none'
  ) {
    await this.ensureTokenValid();
    const config: AxiosRequestConfig = {
      headers: {
        Authorization: 'Bearer ' + this.token,
      },
    };
    try {
      const response = await this.requestAxiosInstance.get(
        `/workspaceMetrics?workspaceId=${workspaceId}&metricName=${metricName}&aggregation=${aggregation}`,
        config
      );
      return response.data;
    } catch (e) {
      console.error(e);
    }
  }
}
