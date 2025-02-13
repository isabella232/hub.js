import {
  IHubRequestOptions,
  isGuid,
  stripProtocol,
  IModel,
  getSiteById,
  lookupDomain,
} from "..";

/**
 * Returns site model given various kinds of identifier
 *
 * @param identifier - a site item ID, site hostname, enterprise site slug, or full site URL
 * @param hubRequestOptions
 */
export function fetchSiteModel(
  identifier: string,
  hubRequestOptions: IHubRequestOptions
) {
  let prms;

  if (isGuid(identifier)) {
    prms = getSiteById(identifier, hubRequestOptions);
  } else {
    let hostnameOrSlug = identifier;

    // get down the the hostname
    hostnameOrSlug = stripProtocol(hostnameOrSlug);
    hostnameOrSlug = hostnameOrSlug.split("/")[0];

    prms = lookupDomain(hostnameOrSlug, hubRequestOptions).then(({ siteId }) =>
      getSiteById(siteId, hubRequestOptions)
    );
  }

  return prms;
}

/**
 * @private // keep out of docs
 */
/* istanbul ignore next */
export function fetchSite(
  identifier: string,
  hubRequestOptions: IHubRequestOptions
): Promise<IModel> {
  // tslint:disable-next-line
  console.warn(
    `@esri/hub-common::fetchSite is deprecated. Please use @esri/hub-common::fetchSiteModel instead`
  );
  return fetchSiteModel(identifier, hubRequestOptions);
}
