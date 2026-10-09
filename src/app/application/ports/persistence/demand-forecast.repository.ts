import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';

export interface DemandForecastRepository {
  getVenueForecast(venueId: string): Observable<VenueDemandForecast>;
}

export const DEMAND_FORECAST_REPOSITORY_TOKEN = new InjectionToken<DemandForecastRepository>(
  'DEMAND_FORECAST_REPOSITORY_TOKEN'
);
