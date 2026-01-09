import { registerDecorator, ValidationOptions } from 'class-validator';
import { ASCII_EMAIL_REGEX } from '../constants';

export function IsValidEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAsciiEmail',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return ASCII_EMAIL_REGEX.test(value);
        },
        defaultMessage() {
          return 'Email must be a valid ASCII email address';
        },
      },
    });
  };
}
