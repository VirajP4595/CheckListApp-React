export const AppConfig = {
    dataverse: {
        //url: "https://org35f22684.crm.dynamics.com",//SPForDev
        url: "https://priceaplandev.crm6.dynamics.com",//PAPDev
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        //absoluteUrl: "https://spfordev.sharepoint.com/sites/PAPChecklist", //SPForDev
        absoluteUrl: "https://adriennesimmons.sharepoint.com/sites/IntranetDev", //PAPDev
        documentLibrary: "PAPAttachments"
    }
    // Auth config removed - handled by SPFx Context
};
