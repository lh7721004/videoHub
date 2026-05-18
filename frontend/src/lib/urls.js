import { API_BASE_URL } from './api';

const trimRight = (value) => value.replace(/\/+$/, '');
const trimLeft = (value) => value.replace(/^\/+/, '');

function defaultWsBaseUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function buildApiUrl(path) {
  const base = API_BASE_URL || '/api';
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return `${trimRight(base)}/${trimLeft(path)}`;
  }
  return `${trimRight(base)}/${trimLeft(path)}`;
}

export function buildWsUrl(path) {
  const base = import.meta.env.VITE_WS_BASE_URL || defaultWsBaseUrl();
  return `${trimRight(base)}/${trimLeft(path)}`;
}

export function buildLiveUrl(path) {
  const base = import.meta.env.VITE_LIVE_BASE_URL || '/live';
  return `${trimRight(base)}/${trimLeft(path)}`;
}
