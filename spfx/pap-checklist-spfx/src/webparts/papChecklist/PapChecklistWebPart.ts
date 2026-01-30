import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import { IReadonlyTheme } from '@microsoft/sp-component-base';

import * as strings from 'PapChecklistWebPartStrings';
import App from '../../App';
import { initializeServices } from '../../services/serviceFactory';
import { FluentProvider, webLightTheme, IdPrefixProvider } from '@fluentui/react-components';

// Removed static import to prevent unconditional loading
// import styles from './ImmersiveMode.module.scss';
import { UrlQueryParameterCollection } from '@microsoft/sp-core-library';

export interface IPapChecklistWebPartProps {
  description: string;
}

export default class PapChecklistWebPart extends BaseClientSideWebPart<IPapChecklistWebPartProps> {

  private _isDarkTheme: boolean = false;

  public render(): void {
    const element = React.createElement(
      IdPrefixProvider,
      { value: 'pap-checklist-' },
      React.createElement(
        FluentProvider,
        { theme: webLightTheme, style: { height: '100%', background: 'transparent' } },
        React.createElement(App, {
          userDisplayName: this.context.pageContext.user.displayName,
          userEmail: this.context.pageContext.user.email,
          userId: this.context.pageContext.user.loginName,
          siteUrl: this.context.pageContext.web.absoluteUrl
        })
      )
    );

    ReactDom.render(element, this.domElement);
  }

  protected async onInit(): Promise<void> {
    await super.onInit();

    // Initialize our Services with SPFx Context
    await initializeServices(this.context);

    // Check for ?showsp=true query param
    // using standard URLSearchParams for reliability
    const urlParams = new URLSearchParams(window.location.search);
    const showSp = urlParams.get('showsp');

    console.log('PAP Debug: Immersive Mode Check', {
      href: window.location.href,
      search: window.location.search,
      showSpValue: showSp,
      shouldHide: showSp?.toLowerCase() !== 'true'
    });

    // If showsp is NOT true, load the immersive styles DYNAMICALLY
    if (showSp?.toLowerCase() !== 'true') {
      try {
        // Dynamic import ensures styles are only injected when this line runs
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        await import(
          /* webpackChunkName: "immersive-mode-css" */
          './ImmersiveMode.module.scss'
        );
        console.log('PAP Checklist: Immersive Mode CSS Loaded');
      } catch (e) {
        console.error('PAP Checklist: Failed to load immersive mode styles', e);
      }
    }
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }
    this._isDarkTheme = !!currentTheme.isInverted;

    // Pass theme to V9 provider if we want dynamic theming, ideally strictly typed
    // For now we used webLightTheme fixed, but could map legacy theme to v9 theme
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.BasicGroupName,
              groupFields: [
                PropertyPaneTextField('description', {
                  label: strings.DescriptionFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
