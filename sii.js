const axios = require('axios');

class SII {
  #authenticated = false;
  #token = null;
  #prodAPIUrl = process.env.PROD_API_URL || 'https://api.sii.cl/recursos/v1';
  #prodEnviosAPIUrl = process.env.PROD_ENVIOS_API_URL || 'https://rahue.sii.cl/recursos/v1';
  #credentials = null;
  #userAgent = null;
  #xmlns = null;
  #algorithm = null;
  #uri = null;
  #modulus = null;
  #exponent = null;
  #x509Certificate = null;
  #DigestValue = null;
  #SignatureValue = null;

  constructor() {}

  async authenticate() {
    const semilla = await this._getSemilla();
    const token = await this._getToken(semilla, this.xmlns, this.algorithm, this.uri, this.modulus, this.exponent, this.x509Certificate);
    this.#token = token;
    this.#authenticated = this.#token ? true : false;
  }

  async _getSemilla() {
    const semilla = await this._fetchSemilla();
    return semilla;
  }

  async _fetchSemilla() {
    try {
      const res = await axios.get('/boleta.electronica.semilla');
      if (res.status === 200) {
        const { RESP_BODY, RESP_HDR } = res.data;
        const { SEMILLA } = RESP_BODY;
        const { ESTADO } = RESP_HDR;
        if (ESTADO === 0) {
          return SEMILLA;
        } else {
          throw new Error('Error obteniendo semilla');
        }
      } else {
        throw new Error(`Request failed with status code: ${res.status}`);
      }
    } catch (err) {
      throw new Error(`Error fetching semilla: ${err.message}`);
    }
  }

  async _getToken(semilla, xmlns, algorithm, uri, modulus, exponent, x509Certificate) {
    const requestBody = this._createTokenRequestBody(semilla, xmlns, algorithm, uri, modulus, exponent, x509Certificate);
    const token = await this._fetchToken(requestBody);
    return token;
  }
  _createTokenRequestBody(semilla, xmlns, algorithm, uri, modulus, exponent, x509Certificate) {
    return {
      item: {
        Semilla: semilla
      },
      Signature: {
        xmlns: xmlns,
        SignedInfo: {
          CanonicalizationMethod: {
            Algorithm: algorithm
          },
          SignatureMethod: {
            Algorithm: algorithm
          },
          Reference: {
            URI: uri,
            Transforms: {
              Transform: {
                Algorithm: algorithm
              }
            },
            DigestMethod: {
              Algorithm: algorithm
            },
            DigestValue: this.#DigestValue
          },
          SignatureValue: this.#SignatureValue,
          KeyInfo: {
            KeyValue: {
              RSAKeyValue: {
                Modulus: modulus,
                Exponent: exponent
              }
            },
            X509Data: {
              X509Certificate: x509Certificate
            }
          }
        }
      }
    };
  }

  async _fetchToken(requestBody) {
    try {
      const res = await axios.post('/boleta.electronica.token', requestBody);
      const { RESP_HDR, RESP_BODY } = res.data;
      const { ESTADO, GLOSA } = RESP_HDR;
      const { TOKEN } = RESP_BODY;
      console.log(`ESTADO: ${ESTADO}, GLOSA: ${GLOSA}, TOKEN: ${TOKEN}`);
      return { ESTADO, GLOSA, TOKEN };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async boletaElectronicaEnvio(userAgent, body) {
    const url = `${this.#prodEnviosAPIUrl}/boleta.electronica.envio`;

    const headers = {
      'User-Agent': userAgent
    };

    const options = {
      method: 'POST',
      headers,
      data: body,
      url
    };
    try {
      const res = await axios(options);
      const { data, headers, status } = res;

      if (status === 200) {
        const {
          'X-Location': xLocation,
          'X-Retry-After': xRetryAfter,
          'X-RateLimit-Limit': xRateLimitLimit,
          'X-RateLimit-Remaining': xRateLimitRemaining,
          'X-RateLimit-Reset': xRateLimitReset
        } = headers;

        const { rut_emisor, rut_envia, trackid, fecha_recepcion, estado, file, mensaje, codigo } = data;

        const resultadoEnvioPost = {
          rut_emisor,
          rut_envia,
          trackid,
          fecha_recepcion,
          estado,
          file,
          mensaje,
          codigo
        };

        return {
          xLocation,
          xRetryAfter,
          xRateLimitLimit,
          xRateLimitRemaining,
          xRateLimitReset,
          resultadoEnvioPost
        };
      } else {
        return {
          codigo: '',
          mensaje: 'Error inesperado'
        };
      }
    } catch (err) {
      console.error(err);
      return {
        codigo: '',
        mensaje: 'Error inesperado'
      };
    }
  }

  async boletaElectronicaEnvioEstado(rut, dv, trackid) {
    const url = `${this.#prodEnviosAPIUrl}/boleta.electronica.envio/${rut}-${dv}-${trackid}`;

    try {
      const res = await axios.get(url);
      const { data, status } = res;

      if (status === 200) {
        const { rut_emisor, rut_envia, trackid, fecha_recepcion, estado, file, mensaje, codigo } = data;
        return {
          rut_emisor,
          rut_envia,
          trackid,
          fecha_recepcion,
          estado,
          file,
          mensaje,
          codigo
        };
      } else {
        return {
          codigo: '',
          mensaje: 'Error inesperado'
        };
      }
    } catch (err) {
      console.error(err);
      return {
        codigo: '',
        mensaje: 'Error inesperado'
      };
    }
  }
  async getEstadoBoletaElectronica(rut_receptor, dv_receptor, monto, fecha) {
    try {
      const response = await axios.get(this.#prodAPIUrl + '/globales/boleta.electronica.estado', {
        params: {
          rut_receptor,
          dv_receptor,
          monto,
          fecha
        }
      });

      return response.data;
    } catch (error) {
      console.error(error);
      return error;
    }
  }

  async getTiposBoletaElectronica() {
    try {
      const response = await axios.get(this.#prodAPIUrl + '/globales/boleta.electronica.tipo');
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }

  async getNivelErrorBoletaElectronica() {
    try {
      const response = await axios.get(this.#prodAPIUrl + '/globales/boleta.electronica.nivel');
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }

  async getSeccionesBoletaElectronica() {
    try {
      const response = await axios.get(this.#prodAPIUrl + '/globales/boleta.electronica.seccion');
      return response.data;
    } catch (error) {
      console.error(error);
    }
  }
}

module.exports = SII;