import { ValidationFailedError } from '@shared/errors/AppError';

export const COLOR_KEYS = ['primaryColor', 'secondaryColor', 'accentColor'] as const;
export type ColorKey = (typeof COLOR_KEYS)[number];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type BrandingColors = Record<ColorKey, string | null>;

/** A company's theme colours. `null` means "use the Invespy default". */
export class Branding {
  private constructor(
    private readonly _organizationId: string,
    private readonly _colors: BrandingColors,
  ) {}

  static empty(organizationId: string): Branding {
    return new Branding(organizationId, {
      primaryColor: null,
      secondaryColor: null,
      accentColor: null,
    });
  }

  static rehydrate(organizationId: string, colors: BrandingColors): Branding {
    return new Branding(organizationId, { ...colors });
  }

  get organizationId(): string {
    return this._organizationId;
  }
  get colors(): BrandingColors {
    return { ...this._colors };
  }

  /**
   * Applies only the given keys (`undefined` = unchanged, `null` = clear). Every bad key is
   * reported at once on its own field.
   */
  applyColors(changes: Partial<Record<ColorKey, string | null>>): void {
    const bad = COLOR_KEYS.filter((key) => {
      const value = changes[key];
      return value !== undefined && value !== null && !HEX_COLOR.test(value);
    });
    if (bad.length > 0) {
      throw new ValidationFailedError(
        bad.map((field) => ({ field, messages: [`${field} must be a hex color like #0d9488.`] })),
      );
    }
    for (const key of COLOR_KEYS) {
      const value = changes[key];
      if (value !== undefined) this._colors[key] = value === null ? null : value.toLowerCase();
    }
  }
}
