import {
  getItemData,
  getItemGroups,
  getUser,
  IGetUserOptions
} from "@esri/arcgis-rest-portal";
import {
  IHubContent,
  IHubRequestOptions,
  IEnrichmentErrorInfo,
  cloneObject,
  getProp,
  getItemHomeUrl,
  getItemApiUrl,
  getItemDataUrl,
  getItemThumbnailUrl,
  includes
} from "@esri/hub-common";
import { getContentMetadata } from "./metadata";

interface IMetadataPaths {
  updateFrequency: string;
  metadataUpdateFrequency: string;
  metadataUpdatedDate: string;
  reviseDate: string;
  pubDate: string;
  createDate: string;
}

/**
 * The possible values for updateFrequency
 *
 * @enum {string}
 */
export enum UpdateFrequency {
  Continual = "continual",
  Daily = "daily",
  Weekly = "weekly",
  Fortnightly = "fortnightly",
  Monthly = "monthly",
  Quarterly = "quarterly",
  Biannually = "biannually",
  Annually = "annually",
  AsNeeded = "as-needed",
  Irregular = "irregular",
  NotPlanned = "not-planned",
  Unknown = "unknown",
  Semimonthly = "semimonthly"
}

enum DatePrecision {
  Year = "year",
  Month = "month",
  Day = "day",
  Time = "time"
}

function getMetadataPath(identifier: keyof IMetadataPaths) {
  // NOTE: i have verified that this will work regardless of the "Metadata Style" set on the org
  const metadataPaths: IMetadataPaths = {
    updateFrequency:
      "metadata.metadata.dataIdInfo.resMaint.maintFreq.MaintFreqCd.@_value",
    reviseDate: "metadata.metadata.dataIdInfo.idCitation.date.reviseDate",
    pubDate: "metadata.metadata.dataIdInfo.idCitation.date.pubDate",
    createDate: "metadata.metadata.dataIdInfo.idCitation.date.createDate",
    metadataUpdateFrequency:
      "metadata.metadata.mdMaint.maintFreq.MaintFreqCd.@_value",
    metadataUpdatedDate: "metadata.metadata.mdDateSt"
  };
  return metadataPaths[identifier];
}

function getValueFromMetadata(
  content: IHubContent,
  identifier: keyof IMetadataPaths
) {
  const path = getMetadataPath(identifier);
  return path && getProp(content, path);
}
/**
 * Parses an ISO8601 date string into a date and a precision.
 * This is because a) if somone entered 2018, we want to respect that and not treat it as the same as 2018-01-01
 * and b) you cannot naively call new Date with an ISO 8601 string that does not include time information
 * For example, when I, here in mountain time, do new Date('2018').getFullYear() I get "2017".
 * This is because when you do not provide time or timezone info, UTC is assumed, so new Date('2018') is 2018-01-01T00:00:00 in UTC
 * which is actually 7 hours earlier here in mountain time.
 *
 * @param {string} isoString
 * @return { date: Date, precision: DatePrecision }
 */
export function parseISODateString(isoString: string) {
  isoString = `${isoString}`;
  let date;
  let precision;
  if (/^\d{4}$/.test(isoString)) {
    // yyyy
    date = new Date(+isoString, 0, 1);
    precision = DatePrecision.Year;
  } else if (/^\d{4}-\d{1,2}$/.test(isoString)) {
    // yyyy-mm
    const parts = isoString.split("-");
    date = new Date(+parts[0], +parts[1] - 1, 1);
    precision = DatePrecision.Month;
  } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(isoString)) {
    // yyyy-mm-dd
    const parts = isoString.split("-");
    date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    precision = DatePrecision.Day;
  } else if (!Number.isNaN(Date.parse(isoString))) {
    // any other string parsable to a valid date
    date = new Date(isoString);
    precision = isoString.includes("T")
      ? DatePrecision.Time
      : DatePrecision.Day;
  }
  return date && precision && { date, precision };
}

/**
 * Enriches the content with additional date-related information
 * Note that this is exported to facilitate testing but it should be considered private
 *
 * @private
 * @param {IHubContent} content - the IHubContent object
 * @returns {IHubContent}
 */
export function _enrichDates(content: IHubContent): IHubContent {
  const newContent = cloneObject(content);

  const updateFrequencyMap = {
    "001": UpdateFrequency.Continual,
    "002": UpdateFrequency.Daily,
    "003": UpdateFrequency.Weekly,
    "004": UpdateFrequency.Fortnightly,
    "005": UpdateFrequency.Monthly,
    "006": UpdateFrequency.Quarterly,
    "007": UpdateFrequency.Biannually,
    "008": UpdateFrequency.Annually,
    "009": UpdateFrequency.AsNeeded,
    "010": UpdateFrequency.Irregular,
    "011": UpdateFrequency.NotPlanned,
    "012": UpdateFrequency.Unknown,
    "013": UpdateFrequency.Semimonthly
  } as { [index: string]: UpdateFrequency };

  // updateFrequency:
  const updateFrequencyValue = getValueFromMetadata(
    newContent,
    "updateFrequency"
  );
  if (updateFrequencyValue) {
    newContent.updateFrequency = updateFrequencyMap[updateFrequencyValue];
  }

  // metadataUpdateFrequency
  const metadataUpdateFrequencyValue = getValueFromMetadata(
    newContent,
    "metadataUpdateFrequency"
  );
  if (metadataUpdateFrequencyValue) {
    newContent.metadataUpdateFrequency =
      updateFrequencyMap[metadataUpdateFrequencyValue];
  }

  // metadataUpdatedDate & metadataUpdatedDateSource:
  // updatedDate is set to item.modified
  const metadataUpdatedDate = parseISODateString(
    getValueFromMetadata(newContent, "metadataUpdatedDate")
  );
  if (metadataUpdatedDate) {
    newContent.metadataUpdatedDate = metadataUpdatedDate.date;
    newContent.metadataUpdatedDatePrecision = metadataUpdatedDate.precision;
    newContent.metadataUpdatedDateSource = getMetadataPath(
      "metadataUpdatedDate"
    );
  } else {
    newContent.metadataUpdatedDate = newContent.updatedDate;
    newContent.metadataUpdatedDatePrecision = DatePrecision.Day;
    newContent.metadataUpdatedDateSource = newContent.updatedDateSource;
  }

  // updatedDate & updatedDateSource:
  // updatedDate is already set to item.modified, we will override that if we have reviseDate in metadata or lastEditDate
  const reviseDate = parseISODateString(
    getValueFromMetadata(newContent, "reviseDate")
  );
  const layerLastEditDate = getProp(
    newContent,
    "layer.editingInfo.lastEditDate"
  );
  const serverLastEditDate = getProp(
    newContent,
    "server.editingInfo.lastEditDate"
  );
  newContent.updatedDatePrecision = DatePrecision.Day;
  if (reviseDate) {
    newContent.updatedDate = reviseDate.date;
    newContent.updatedDatePrecision = reviseDate.precision;
    newContent.updatedDateSource = getMetadataPath("reviseDate");
  } else if (layerLastEditDate) {
    newContent.updatedDate = new Date(layerLastEditDate);
    newContent.updatedDateSource = "layer.editingInfo.lastEditDate";
  } else if (serverLastEditDate) {
    newContent.updatedDate = new Date(serverLastEditDate);
    newContent.updatedDateSource = "server.editingInfo.lastEditDate";
  }

  // publishedDate & publishedDateSource:
  // publishedDate is already set to item.created, we will override that if we have pubDate or createdDate in metadata
  const pubDate = parseISODateString(
    getValueFromMetadata(newContent, "pubDate")
  );
  const createDate = parseISODateString(
    getValueFromMetadata(newContent, "createDate")
  );
  newContent.publishedDatePrecision = DatePrecision.Day;
  if (pubDate) {
    newContent.publishedDate = pubDate.date;
    newContent.publishedDatePrecision = pubDate.precision;
    newContent.publishedDateSource = getMetadataPath("pubDate");
  } else if (createDate) {
    newContent.publishedDate = createDate.date;
    newContent.publishedDatePrecision = createDate.precision;
    newContent.publishedDateSource = getMetadataPath("createDate");
  }

  return newContent;
}

const fetchGroupIds = (
  content: IHubContent,
  requestOptions?: IHubRequestOptions
): Promise<string[]> => {
  return getItemGroups(content.id, requestOptions).then(response => {
    const { admin, member, other } = response;
    return [...admin, ...member, ...other].map(group => group.id);
  });
};

const fetchMetadata = (
  content: IHubContent,
  requestOptions?: IHubRequestOptions
) => getContentMetadata(content.id, requestOptions);

const fetchOwnerOrgId = (
  content: IHubContent,
  requestOptions?: IHubRequestOptions
): Promise<string> => {
  const options: IGetUserOptions = {
    username: content.owner,
    ...requestOptions
  };
  return getUser(options).then(user => user.orgId);
};

const fetchContentData = (
  content: IHubContent,
  requestOptions?: IHubRequestOptions
) => {
  return getItemData(content.id, requestOptions);
};

interface IEnrichmentRequests {
  [key: string]: (
    content: IHubContent,
    requestOptions?: IHubRequestOptions
  ) => Promise<unknown>;
}

const enrichmentRequests: IEnrichmentRequests = {
  // portal only
  groupIds: fetchGroupIds,
  metadata: fetchMetadata,
  // both portal and hub
  data: fetchContentData,
  orgId: fetchOwnerOrgId
};

// TODO: use family instead
const shouldFetchData = (content: IHubContent) => {
  // TODO: we probably want to fetch data by default for other types of data
  return !content.data && includes(["template", "solution"], content.hubType);
};

const isHubCreatedContent = (content: IHubContent) => {
  const hubTypeKeywords = ["Enterprise Sites", "ArcGIS Hub"];
  const contentTypeKeywords = content.typeKeywords || [];
  // currently Hub only creates web maps, so
  // we may want to remove or modify this type check later
  return (
    content.type === "Web Map" &&
    contentTypeKeywords.some(
      typeKeyword => hubTypeKeywords.indexOf(typeKeyword) > -1
    )
  );
};

const shouldFetchOrgId = (content: IHubContent) => {
  return !content.orgId && isHubCreatedContent(content);
};

// as this becomes more complicated, we'll probably want to
// export it (at least privately?) for testing w/o stubs
const getMissingEnrichments = (content: IHubContent) => {
  const enrichments: string[] = [];
  if (!content.groupIds) {
    enrichments.push("groupIds");
  }
  if (typeof content.metadata === "undefined") {
    // the hub api returns null when there is no metadata
    enrichments.push("metadata");
  }
  if (shouldFetchOrgId(content)) {
    enrichments.push("orgId");
  }
  if (shouldFetchData(content)) {
    enrichments.push("data");
  }
  return enrichments;
};

/**
 * get portal URL (home, API, and data) properties for content
 *
 * @param content Hub content
 * @param requestOptions Request options
 * @returns a hash with the portal URLs
 * @export
 */
export const getPortalUrls = (
  content: IHubContent,
  requestOptions: IHubRequestOptions
) => {
  const authentication = requestOptions.authentication;
  const token = authentication && authentication.token;
  // add properties that depend on portal
  const portalHomeUrl = getItemHomeUrl(content.id, requestOptions);
  // the URL of the item's Portal API end point
  const portalApiUrl = getItemApiUrl(content, requestOptions, token);
  // the URL of the item's data API end point
  const portalDataUrl = getItemDataUrl(content, requestOptions, token);
  // the full URL of the thumbnail
  const thumbnailUrl = getItemThumbnailUrl(content, requestOptions, {
    token
  });
  return {
    portalHomeUrl,
    portalApiUrl,
    portalDataUrl,
    thumbnailUrl
  };
};
export interface IFetchEnrichmentOptions extends IHubRequestOptions {
  /**
   * comma separated list of enrichment (property) names to fetch
   * if omitted, the default enrichments will be fetched
   * to skip fetching enrichments, pass an empty array []
   */
  enrichments?: string[];
}

/**
 * Fetch either the missing or specified enrichments for a given content.
 * Any errors from failed requests will be included in the errors array.
 *
 * @param content content to fetch enrichments for
 * @param requestOptions request options which may include a list of specific enrichments to fetch
 * @returns a hash of enriched content properties
 */
export const fetchEnrichments = (
  content: IHubContent,
  requestOptions?: IFetchEnrichmentOptions
): Partial<IHubContent> => {
  // get the list of enrichments to fetch
  const enrichments =
    (requestOptions && requestOptions.enrichments) ||
    getMissingEnrichments(content);
  // only include the enrichments that we know how to enrich
  const validEnrichments = enrichments.filter(
    name => !!enrichmentRequests[name]
  );
  const errors: IEnrichmentErrorInfo[] = [];
  const requests = validEnrichments.map(enrichment => {
    // initiate the request and return the promise
    const request = enrichmentRequests[enrichment];
    return request(content, requestOptions).catch(e => {
      // there was an error w/ the request, capture it
      const message = (e && e.message) || e;
      errors.push({
        // NOTE: for now we just return the message and type "Other"
        // but we could later introspect for HTTP or AGO errors
        // and/or return the status code if available
        type: "Other",
        message
      });
      // and then set this property to null
      return null;
    });
  });
  return Promise.all(requests).then(values => {
    // return a hash of enrichment properties with the errors merged in
    const properties: { [key: string]: unknown } = {};
    values.forEach((value, i) => {
      const name = validEnrichments[i];
      properties[name] = value;
    });
    return {
      ...properties,
      errors
    };
  });
};

/**
 * Enrich content by fetching missing (or specified) enrichments and adding them as properties.
 *
 * To only fetch specific enrichments, pass an array of property names as the second
 * @param content content to enrich
 * @param requestOptions request options which may include a list of specific enrichments to fetch
 * @returns a new content with enriched properties added
 */
export const enrichContent = (
  content: IHubContent,
  requestOptions?: IFetchEnrichmentOptions
) => {
  // get enriched portal urls
  const portalUrls = getPortalUrls(content, requestOptions);
  // fetch any missing or requested enrichments
  return fetchEnrichments(content, requestOptions).then(
    (enrichments: Partial<IHubContent>) => {
      const serverErrors = content.errors || [];
      // merge derived portal URLs & fetched enrichments into content
      const merged = {
        ...content,
        ...portalUrls,
        ...enrichments,
        // include any previous errors (if any)
        errors: [...serverErrors, ...enrichments.errors]
      };
      // return the content with enriched dates
      return _enrichDates(merged);
    }
  );
};