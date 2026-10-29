import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmPasswordService } from '../../services/confirm-password.service';

@Component({
  selector: 'app-confirm-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './confirm-password-dialog.component.html',
  styleUrl: './confirm-password-dialog.component.css',
})
export class ConfirmPasswordDialogComponent {
  constructor(public srv: ConfirmPasswordService) {}
}
