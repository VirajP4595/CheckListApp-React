/**
 * Utility script to discover navigation property names from Dataverse metadata
 * Run this in browser console after authenticating
 */

// This function can be added to dataverseService.ts temporarily for debugging
export async function discoverNavigationProperties(entityName: string): Promise<void> {
    const baseUrl = 'https://org35f22684.crm.dynamics.com/api/data/v9.2';

    // Get token (assumes we're authenticated)
    const token = localStorage.getItem('msal.token') || prompt('Enter access token:');

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };

    // Query entity metadata including relationships
    const url = `${baseUrl}/EntityDefinitions(LogicalName='${entityName}')?$expand=OneToManyRelationships,ManyToOneRelationships`;

    try {
        const response = await fetch(url, { headers });
        const data = await response.json();

        console.log('=== One-to-Many Relationships (this entity is the "One" parent) ===');
        data.OneToManyRelationships?.forEach((rel: any) => {
            console.log(`  Schema: ${rel.SchemaName}`);
            console.log(`  Nav Prop (on this entity): ${rel.ReferencingEntityNavigationPropertyName}`);
            console.log(`  Referenced Attribute: ${rel.ReferencedAttribute}`);
            console.log(`  Referencing Entity: ${rel.ReferencingEntity}`);
            console.log('---');
        });

        console.log('=== Many-to-One Relationships (this entity has a lookup) ===');
        data.ManyToOneRelationships?.forEach((rel: any) => {
            console.log(`  Schema: ${rel.SchemaName}`);
            console.log(`  Nav Prop (on referenced/parent): ${rel.ReferencedEntityNavigationPropertyName}`);
            console.log(`  Referenced Entity: ${rel.ReferencedEntity}`);
            console.log('---');
        });

    } catch (error) {
        console.error('Error querying metadata:', error);
    }
}

// Usage: Run in browser console after pasting this code
// discoverNavigationProperties('pap_checklist');
// discoverNavigationProperties('pap_workgroup');
