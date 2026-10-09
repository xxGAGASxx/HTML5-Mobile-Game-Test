/** A fact that happened in one bounded context and may interest others. */
export interface DomainEvent<TType extends string = string> {
  readonly type: TType;
}
