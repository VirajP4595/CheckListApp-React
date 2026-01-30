export const AppConfig = {
    dataverse: {
        url: "https://org35f22684.crm.dynamics.com",
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        absoluteUrl: "https://spfordev.sharepoint.com/sites/PAPChecklist", // Renamed for clarity in SPFx
        documentLibrary: "PAPAttachments"
    }
    // Auth config removed - handled by SPFx Context
};
