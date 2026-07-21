export type UserNameFields = {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  suffix?: string | null;
};

type UserNameRecord = {
  name?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  suffix?: string | null;
};

export const normalizeUserNamePart = (value?: string | null) => (
  String(value || '').trim().replace(/\s+/g, ' ')
);

export const composeUserName = (fields: UserNameFields) => [
  fields.firstName,
  fields.middleName,
  fields.lastName,
  fields.suffix,
].map(normalizeUserNamePart).filter(Boolean).join(' ');

export const getUserDisplayName = (user?: UserNameRecord | null) => {
  if (!user) return '';

  const structured = composeUserName({
    firstName: user.first_name,
    middleName: user.middle_name,
    lastName: user.last_name,
    suffix: user.suffix,
  });

  return structured
    || normalizeUserNamePart(user.display_name)
    || normalizeUserNamePart(user.full_name)
    || normalizeUserNamePart(user.name);
};
