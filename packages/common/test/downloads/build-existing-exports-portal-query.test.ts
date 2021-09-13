import { buildExistingExportsPortalQuery } from "../../src";

describe("buildExistingExportsPortalQuery", () => {
  it("builds query with no options", () => {
    const q = buildExistingExportsPortalQuery("123456789");

    expect(q).toEqual(
      '(typekeywords:"exportItem:123456789" AND typekeywords:"exportLayer:null") AND ( (type:"CSV" AND typekeywords:"spatialRefId:4326") OR  (type:"CSV Collection" AND typekeywords:"spatialRefId:4326") OR  (type:"KML" AND typekeywords:"spatialRefId:4326") OR  (type:"KML Collection" AND typekeywords:"spatialRefId:4326") OR  (type:"Shapefile" AND typekeywords:"spatialRefId:4326") OR  (type:"File Geodatabase" AND typekeywords:"spatialRefId:4326") OR  (type:"GeoJson" AND typekeywords:"spatialRefId:4326") OR  (type:"Microsoft Excel" AND typekeywords:"spatialRefId:4326") OR  (type:"Feature Collection" AND typekeywords:"spatialRefId:4326"))'
    );
  });

  it("builds query with layerId", () => {
    const q = buildExistingExportsPortalQuery("123456789", {
      layerId: 2,
    });

    expect(q).toEqual(
      '(typekeywords:"exportItem:123456789" AND typekeywords:"exportLayer:02") AND ( (type:"CSV" AND typekeywords:"spatialRefId:4326") OR  (type:"CSV Collection" AND typekeywords:"spatialRefId:4326") OR  (type:"KML" AND typekeywords:"spatialRefId:4326") OR  (type:"KML Collection" AND typekeywords:"spatialRefId:4326") OR  (type:"Shapefile" AND typekeywords:"spatialRefId:4326") OR  (type:"File Geodatabase" AND typekeywords:"spatialRefId:4326") OR  (type:"GeoJson" AND typekeywords:"spatialRefId:4326") OR  (type:"Microsoft Excel" AND typekeywords:"spatialRefId:4326") OR  (type:"Feature Collection" AND typekeywords:"spatialRefId:4326"))'
    );
  });

  it("scopes query to only some types", () => {
    const q = buildExistingExportsPortalQuery("123456789", {
      layerId: 2,
      onlyTypes: ["CSV Collection", "KML Collection"],
    });

    expect(q).toEqual(
      '(typekeywords:"exportItem:123456789" AND typekeywords:"exportLayer:02") AND ( (type:"CSV Collection" AND typekeywords:"spatialRefId:4326") OR  (type:"KML Collection" AND typekeywords:"spatialRefId:4326"))'
    );
  });

  it("applies spatialRefId selectively based on export type projection support", () => {
    const q = buildExistingExportsPortalQuery("123456789", {
      layerId: 2,
      onlyTypes: ["CSV Collection", "KML Collection"],
      spatialRefId: "10200",
    });

    expect(q).toEqual(
      '(typekeywords:"exportItem:123456789" AND typekeywords:"exportLayer:02") AND ( (type:"CSV Collection" AND typekeywords:"spatialRefId:10200") OR  (type:"KML Collection" AND typekeywords:"spatialRefId:4326"))'
    );
  });
});
