import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ALLOWED_IMAGE_MIME_TYPES } from '../types/mime-type.types';

@ValidatorConstraint({ async: false })
export class IsImageMimeTypeConstraint implements ValidatorConstraintInterface {
  validate(mimeType: any): boolean {
    if (typeof mimeType !== 'string') return false;
    const normalized = mimeType.toLowerCase();
    return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
  }

  defaultMessage(): string {
    return `mimeType must be one of: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`;
  }
}

export function IsImageMimeType(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isImageMimeType',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsImageMimeTypeConstraint,
    });
  };
}
