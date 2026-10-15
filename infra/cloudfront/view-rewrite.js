// Viewer request, cloudfront-js-2.0. Mirrors next.config.ts's development view rule.
// AIRCRAFT_IDS is copied from lib/systems.ts, ENGINE_IDS from engines/index.ts and COMPONENT_IDS from
// engines/components/index.ts; the offline test prevents drift.
// Event/query format: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
var AIRCRAFT_IDS = ["sr20", "sr22t", "c172s", "c182t", "da40", "m20c"];
var ENGINE_IDS = ["io390", "o360"];
var COMPONENT_IDS = ["carburetor"];

// AWS recommends percent encoding; UTF-8 request values are forwarded unchanged:
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/edge-function-restrictions-all.html
function encodeQueryComponent(value) {
  // Escape raw separators/control characters without double-encoding existing percent escapes.
  // Keep '+' as the original form-query space marker; an encoded literal plus stays %2B.
  return value
    .split("+")
    .map(function (part) {
      return encodeURIComponent(part).replace(/%25([0-9a-f]{2})/gi, "%$1");
    })
    .join("+");
}

/** A permanent redirect to `uri`, keeping the request's query (every value of a repeated key, re-encoded). */
function redirect(request, uri) {
  var query = [];
  Object.keys(request.querystring).forEach(function (key) {
    var item = request.querystring[key];
    var values = item.multiValue || [item];
    values.forEach(function (entry) {
      query.push(encodeQueryComponent(key) + "=" + encodeQueryComponent(entry.value));
    });
  });
  return {
    statusCode: 308,
    statusDescription: "Permanent Redirect",
    headers: {
      location: { value: uri + (query.length ? "?" + query.join("&") : "") },
    },
  };
}

function handler(event) {
  var request = event.request;
  // the static export writes each engine page as engines/<id>.html; the trailing-slash form redirects to it
  // (and each component page as components/<id>.html)
  var page = /^\/(engines|components)\/([^/]+)(\/)?$/.exec(request.uri);
  if (page && (page[1] === "engines" ? ENGINE_IDS : COMPONENT_IDS).indexOf(page[2]) !== -1) {
    if (page[3]) return redirect(request, request.uri.slice(0, -1));
    request.uri = request.uri + ".html";
    return request;
  }
  var match = /^\/([^/]+)(?:\/([^/]+))?(\/)?$/.exec(request.uri);
  if (!match || AIRCRAFT_IDS.indexOf(match[1]) === -1) return request;
  if (match[3]) return redirect(request, request.uri.slice(0, -1));

  request.uri = "/index.html";
  return request;
}
