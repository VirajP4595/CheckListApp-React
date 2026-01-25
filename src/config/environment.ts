export const AppConfig = {
    dataverse: {
        url: "https://org35f22684.crm.dynamics.com",
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        siteUrl: "https://spfordev.sharepoint.com/sites/PAPChecklist",
        documentLibrary: "PAPAttachments"  // Matches provisioning script
    },
    auth: {
        clientId: "0de2c80b-7f29-4e3f-9b5b-db733a407752",
        tenantId: "70aa9297-2d55-462b-83a2-2166bbf3ac1c",
        authority: "https://login.microsoftonline.com/70aa9297-2d55-462b-83a2-2166bbf3ac1c",
        redirectUri: "http://localhost:3000",
        scopes: {
            dataverse: ["https://org35f22684.crm.dynamics.com/.default"],
            graph: ["User.Read", "Sites.ReadWrite.All"]
        }
    }
};
