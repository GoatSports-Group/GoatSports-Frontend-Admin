import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';
import {
  DEMAND_FORECAST_REPOSITORY_TOKEN,
  DemandForecastRepository
} from '@application/ports/persistence/demand-forecast.repository';

@Injectable({ providedIn: 'root' })
export class GetVenueDemandForecastUseCase {
  constructor(
    @Inject(DEMAND_FORECAST_REPOSITORY_TOKEN)
    private readonly repository: DemandForecastRepository
  ) { }

  execute(venueId: string): Observable<VenueDemandForecast> {
    return this.repository.getVenueForecast(venueId);
  }
}
