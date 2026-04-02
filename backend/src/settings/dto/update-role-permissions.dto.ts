import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionItemDto {
  @ApiProperty({ example: 'manage_rooms' })
  @IsString()
  permissionKey: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [PermissionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[];
}


