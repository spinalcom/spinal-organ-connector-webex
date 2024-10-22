
export interface IWorkplaceListApiResponse {
    items: Array<IWorkspaceInfo>;
}

export interface IWorkspaceInfo{
    id: string;
        orgId: string;
        displayName: string;
        type?: string;
        sipAddress: string;
        created: string;
        calling: {
            type: string;
        };
        calendar: {
            type: string;
            emailAddress?: string;
        };
        hotdeskingStatus: string;
        deviceHostedMeetings: {
            enabled: boolean;
            siteUrl?: string;
        };
        supportedDevices: string;
        devicePlatform: string;
        capacity?: number;
}