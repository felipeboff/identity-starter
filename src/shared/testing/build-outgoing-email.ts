import { faker } from "@faker-js/faker";

import type { OutgoingEmail } from "../application/ports/mail-sender";

export const buildOutgoingEmail = (
  overrides: Partial<OutgoingEmail> = {},
): OutgoingEmail => ({
  template: faker.lorem.word(),
  to: faker.internet.email(),
  name: faker.person.fullName(),
  subject: faker.lorem.sentence(),
  text: faker.lorem.paragraph(),
  link: faker.internet.url(),
  expiresAt: faker.date.future(),
  layout: {
    category: faker.lorem.word(),
    title: faker.lorem.sentence(),
    paragraphs: [faker.lorem.sentence(), faker.lorem.sentence()],
    action: faker.lorem.words(2),
    validity: faker.lorem.sentence(),
    alert: null,
    footnote: faker.lorem.sentence(),
  },
  ...overrides,
});
