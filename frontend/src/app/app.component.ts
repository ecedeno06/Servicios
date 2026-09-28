import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  // Sin uso directo aqui -- inyectarlo alcanza para que el efecto que
  // aplica data-theme en <html> corra desde el arranque, en cualquier
  // ruta (login, restablecer-password, o ya autenticado).
  constructor(private theme: ThemeService) {}
}
