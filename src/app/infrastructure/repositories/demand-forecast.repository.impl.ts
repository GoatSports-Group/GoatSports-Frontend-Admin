import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';
import { DemandForecastRepository } from '@application/ports/persistence/demand-forecast.repository';
import { DemandForecastApi } from '@infrastructure/api/demand-forecast.api';

@Injectable()
export class DemandForecastRepositoryImpl implements DemandForecastRepository {
  private readonly api = inject(DemandForecastApi);

  getVenueForecast(venueId: string): Observable<VenueDemandForecast> {
    return this.api.getVenueForecast(venueId);
  }
}
