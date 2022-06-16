import { Module } from '@nestjs/common';
import { BundleService } from './bundle.service';
import { BundleController } from './bundle.controller';
import { HttpModule } from '@nestjs/axios';
import { MongooseModule } from '@nestjs/mongoose';
import { Bundle, bundleSchema } from '3dily-schema';

@Module({
  imports: [
    HttpModule,
    MongooseModule.forFeature([{ name: Bundle.name, schema: bundleSchema }]),
  ],
  controllers: [BundleController],
  providers: [BundleService],
})
export class BundleModule {}
