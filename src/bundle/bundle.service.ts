import { Bundle, BundleDocument, Status } from '3dily-schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class BundleService {
  constructor(
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
  ) {}

  queue(query) {
    return this.bundleModel.find(query).sort('createdAt');
  }

  update(id: string, data: any) {
    return this.bundleModel.findByIdAndUpdate(id, data, { new: true });
  }
}
