import {
  PluginErrorType,
  PluginRequestPayload,
  getPluginErrorStatus,
  getPluginSettingsFromHeaders,
} from '@lobehub/chat-plugin-sdk';
import { VercelRequest, VercelResponse } from '@vercel/node';
import Ajv from 'ajv';

import { Gateway, GatewayErrorResponse, GatewayOptions } from './gateway';

export type NodeRuntimeGatewayOptions = Pick<GatewayOptions, 'pluginsIndexUrl'>;

export const createGatewayOnNodeRuntime = (options: NodeRuntimeGatewayOptions = {}) => {
  const gateway = new Gateway({
    ...options,
    Validator: (schema, value) => {
      const ajv = new Ajv({ validateFormats: false });
      const validate = ajv.compile(schema);

      const valid = validate(value);
      return {
        errors: validate.errors,
        valid,
      };
    },
  });

  return async (req: VercelRequest, res: VercelResponse) => {
    // ==========  1. 校验请求方法 ========== //
    if (req.method !== 'POST') {
      res.status(PluginErrorType.MethodNotAllowed).send({
        message: '[gateway] only allow POST method',
      });

      return;
    }

    let requestPayload = req.body as PluginRequestPayload | string;
    if (typeof requestPayload === 'string') {
      requestPayload = JSON.parse(requestPayload) as PluginRequestPayload;
    }

    const settings = getPluginSettingsFromHeaders(req.headers as any);

    try {
      const { data } = await gateway.execute(requestPayload, settings);

      res.send(data);
    } catch (error) {
      console.log(error);
      const { errorType, body } = error as GatewayErrorResponse;

      res.status(getPluginErrorStatus(errorType)).send({ body, errorType });
    }
  };
};
