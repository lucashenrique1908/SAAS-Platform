import { IsUrl, MaxLength } from 'class-validator';

export class RepositoryImportDto {
  @IsUrl({ require_protocol: true, protocols: ['https'] })
  @MaxLength(2048)
  repositoryUrl!: string;
}
