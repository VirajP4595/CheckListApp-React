export const AppConfig = {
    dataverse: {
        //url: "https://org35f22684.crm.dynamics.com",//SPForDev
        url: "https://priceaplandev.crm6.dynamics.com",//PAPDev
        //PROD
        //url: "https://priceapp.crm6.dynamics.com",//PAPDev
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        //absoluteUrl: "https://spfordev.sharepoint.com/sites/PAPChecklist", //SPForDev
        absoluteUrl: "https://adriennesimmons.sharepoint.com/sites/IntranetDev", //PAPDev
        documentLibrary: "PAPAttachments"
    },
    // Auth config removed - handled by SPFx Context
    admin: {
        superAdminGroup: "SP_Checklist_SuperAdmin"
    },
    powerAutomate: {
        //DEV
        createChecklistFlowUrl: "https://644999d214b2ecea9a447627ced3c4.c0.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/49885650306b46d59224d1bf6bf6e1ab/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=Wax0w4aai9NtAbtJOZ7WcrsZAEfJJy-k11GNBZhisfQ"
        //PROD
        //createChecklistFlowUrl: "YOUR_FLOW_URL_HERE"
    }
};
