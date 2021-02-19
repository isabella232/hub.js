import { UserSession } from "@esri/arcgis-rest-auth";
import { getHubApiUrl } from "@esri/hub-common";
import { ISearchOptions } from "@esri/arcgis-rest-portal";
import { searchItems } from "@esri/arcgis-rest-portal";
import { IContentSearchRequest } from "../types/content";
import { ISearchService, ISearchServiceParams } from "../types/search-service";
import { convertToPortalParams } from "./helpers/convert-request-to-portal-params";
import { convertToHubParams } from "./helpers/convert-request-to-hub-params";
import { ISearchParams } from "../ago/params";
import { hubApiRequest } from "@esri/hub-common";

export class ContentSearchService
  implements ISearchService<IContentSearchRequest, any> {
  private portalUrl: string;
  private isPortal: boolean;
  private hubApiUrl: string;
  private session: UserSession;

  constructor(params: ISearchServiceParams) {
    this.portalUrl = params.portalUrl;
    this.isPortal = params.isPortal;
    this.hubApiUrl = getHubApiUrl(this.portalUrl);
    this.session = params.session;
  }

  search(request: IContentSearchRequest): any {
    if (this.isPortal) {
      return this.enterpriseSearch(request);
    }
    return this.onlineSearch(request);
  }

  private enterpriseSearch(
    request: IContentSearchRequest = { filter: {}, options: {} }
  ): any {
    const requestParams: ISearchOptions = convertToPortalParams(request);
    requestParams.authentication =
      request && request.options && request.options.session
        ? request.options.session
        : this.session;
    requestParams.portalUrl =
      request && request.options && request.options.portal
        ? request.options.portal
        : this.portalUrl;
    requestParams.httpMethod = "POST";
    return searchItems(requestParams);
  }

  private onlineSearch(
    request: IContentSearchRequest = { filter: {}, options: {} }
  ): any {
    const requestParams: ISearchParams = convertToHubParams(request);
    const authentication =
      request && request.options && request.options.session
        ? request.options.session
        : this.session;
    return hubApiRequest("/search", {
      hubApiUrl: this.hubApiUrl,
      authentication,
      isPortal: this.isPortal,
      headers: {
        authentication: JSON.stringify(authentication)
      },
      httpMethod: "POST",
      params: requestParams
    });
  }
}
