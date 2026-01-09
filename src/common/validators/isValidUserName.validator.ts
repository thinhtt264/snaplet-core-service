import { registerDecorator, ValidationOptions } from 'class-validator';
import { USERNAME_REGEX } from '../constants';

export function IsValidUserName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidUserName',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return USERNAME_REGEX.test(value);
        },
        defaultMessage() {
          return 'Username must contain only letters, numbers, and underscores';
        },
      },
    });
  };
}
