// Lives in its own module to avoid a circular import: MovieService and
// SeriesService both throw this, but media-services.ts (which builds the
// service registry) imports those services. Putting the class there
// would mean each service's runtime evaluation pulled the registry
// before its sibling had finished loading, leaving movieService /
// seriesService undefined when mediaServiceFor() runs.

export class RetryNotSupportedError extends Error {
  constructor(action: string) {
    super(`Cannot retry action type: ${action}`);
    this.name = "RetryNotSupportedError";
  }
}
