import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  username = ''; // Limpio para que el usuario ingrese sus credenciales
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  async onSubmit() {
    console.log('🚀 [LoginComponent] Iniciando proceso de autenticación LDAP:', {
      username: this.username,
      timestamp: new Date().toISOString()
    });

    this.error.set(null);
    this.loading.set(true);

    try {
      console.log('⏳ [LoginComponent] Enviando credenciales al servidor LDAP...');
      const resp = await this.auth.login(this.username, this.password).toPromise();

      console.log('📨 [LoginComponent] Respuesta completa del servidor LDAP:', {
        response: resp,
        ok: resp?.ok,
        token: resp?.token ? '***TOKEN_PRESENTE***' : 'NO_TOKEN',
        user: resp?.user,
        error: resp?.error,
        timestamp: new Date().toISOString()
      });

      if (resp?.ok && resp.token) {
        console.log('✅ [LoginComponent] Login exitoso, guardando token y redirigiendo');
        console.log('👤 [LoginComponent] Información del usuario LDAP:', resp.user);
        this.auth.token = resp.token;
        this.router.navigateByUrl('/');
      } else {
        console.log('❌ [LoginComponent] Login fallido:', resp?.error || 'Error de autenticación');
        this.error.set(resp?.error || 'Error de autenticación');
      }
    } catch (e: any) {
      console.error('💥 [LoginComponent] Error en la comunicación con el servidor LDAP:', {
        error: e,
        errorMessage: e?.message,
        errorStatus: e?.status,
        errorStatusText: e?.statusText,
        errorDetails: e?.error,
        timestamp: new Date().toISOString()
      });

      // Manejo específico de errores
      if (e?.status === 401) {
        console.error('🔐 [LoginComponent] Error 401: Credenciales incorrectas o usuario no autorizado');
        this.error.set('Usuario o contraseña incorrectos. Verifica tus credenciales LDAP.');
      } else if (e?.status === 0) {
        console.error('🌐 [LoginComponent] Error de conexión: Backend no disponible');
        this.error.set('No se puede conectar al servidor. Verifica que el backend esté corriendo en localhost:4000');
      } else if (e?.status >= 500) {
        console.error('🔥 [LoginComponent] Error del servidor LDAP');
        this.error.set('Error interno del servidor LDAP. Contacta al administrador.');
      } else {
        this.error.set(e?.error?.error || e?.message || 'Error de comunicación con el servidor');
      }
    } finally {
      this.loading.set(false);
      console.log('🏁 [LoginComponent] Proceso de autenticación terminado');
    }
  }
}