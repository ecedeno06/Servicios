import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Registra los datos del locale espanol (nombres de mes/dia en es, no
// cambia el LOCALE_ID global) para poder pasar 'es' explicito en los
// DatePipe que necesitan el nombre del mes en español (ej. "06-ago", no
// "06-aug"). El resto de la app sigue usando el locale por defecto.
registerLocaleData(localeEs, 'es');

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
