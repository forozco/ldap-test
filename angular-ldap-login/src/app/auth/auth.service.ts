import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

interface LoginResponse {
  ok: boolean;
  token?: string;
  user?: { username: string; dn: string; groups: string[] };
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = '/api'; // Usando proxy, no necesitamos la URL completa

  get token(): string | null {
    return localStorage.getItem('token');
  }
  set token(v: string | null) {
    if (v) localStorage.setItem('token', v);
    else localStorage.removeItem('token');
  }

  login(username: string, password: string) {
    console.log('🔐 [AuthService] Enviando solicitud de login LDAP:', {
      username,
      url: `${this.api}/auth/login`,
      timestamp: new Date().toISOString()
    });

    return this.http.post<LoginResponse>(`${this.api}/auth/login`, { username, password });
  }

  // Método para probar la conectividad con el backend
  testConnection() {
    console.log('🌐 [AuthService] Probando conectividad con el backend...');
    return this.http.get(`${this.api}/health`).pipe(
      tap(response => console.log('✅ [AuthService] Backend disponible:', response)),
      tap({
        error: (error) => console.error('❌ [AuthService] Backend no disponible:', error)
      })
    );
  }

  logout() { this.token = null; }
  isLoggedIn() { return !!this.token; }
}