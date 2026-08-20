
import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Request body'ni berilgan Zod sxemasi asosida tekshiradi.
 * Validatsiyadan o'tgan (parse qilingan) qiymat bilan req.body'ni almashtiradi,
 * shunda controller'da qo'shimcha .parse() chaqirish shart emas.
 */
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validatsiya xatosi',
        details: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    req.body = result.data;
    next();
  };
}