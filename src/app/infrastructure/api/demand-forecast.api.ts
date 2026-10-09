import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { VenueDemandForecast } from '@application/dto/demand-forecast/demand-forecast.dto';
import { environment } from '@environments/environment';

/** ai-service (FastAPI) trả thẳng đối tượng, không bọc BaseResponse như các service Java. */
@Injectable({ providedIn: 'root' })
export class DemandForecastApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/ai-service/api/v1/ai/demand-forecast`;

  getVenueForecast(venueId: string): Observable<VenueDemandForecast> {
    return this.http.get<VenueDemandForecast>(`${this.baseUrl}/venues/${encodeURIComponent(venueId)}`);
  }
}
