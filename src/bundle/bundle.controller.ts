import { HttpService } from '@nestjs/axios';
import { Controller } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { BundleService } from './bundle.service';
import { join } from 'path';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFile,
  writeFileSync,
} from 'fs';
import * as Zip from 'adm-zip';
import { Status } from '3dily-schema';

@Controller('bundle')
export class BundleController {
  constructor(
    private readonly bundleService: BundleService,
    private readonly httpService: HttpService,
  ) {}
  @EventPattern({ cmd: 'SEND' })
  async processBundle(data: any) {
    this.recursive();
    console.log('Done');
  }

  async recursive() {
    const check = await this.bundleService.queue({ status: Status.PENDING });
    console.log('check', check);
    if (check.length > 0) {
      console.log('Hii');
      check[0].status = Status.PROCESS;
      check[0].save();
      const bundle = await this.process({
        bundle: check[0],
        panel: '6291c0a6a1425f3e299446f3',
      });
      console.log('ccccccccccccccccccccc', bundle);
      await this.bundleService.update(bundle._id, { status: Status.DONE });
      this.recursive();
    } else {
      return;
    }
  }

  async process(data: any) {
    const { panel, bundle } = data;
    const array = [];
    const temp = [];
    const Error = [];
    let directory;
    let dup;
    console.log('data', data);
    console.log('bundle', bundle);
    const dir = join(process.env.DIR, 'bundles', bundle._id.toString());
    bundle.status = 'PROCESS';
    for (let i = 0; i < bundle.products.length; i++) {
      const element = bundle.products[i];
      const data = await this.httpService
        .get(`https://dev.api.3dily.com/scene/${panel}/${element.code}/data`)
        .toPromise();
      const layers = data.data.layers;
      for (let x = 0; x < element.variants.length; x++) {
        const el = element.variants[x];
        const { galleryIndex, error } = this.varients(layers, el);
        console.log(galleryIndex);
        console.log('error', error);
        if (error) Error.push(error);
        temp.push({
          id: element._id,
          path: `${galleryIndex}`,
          code: element.code,
        });
        dup = await this.Dupilcate(temp);
        const findIndx = dup.find((e) => e.id === element._id);
        if (findIndx) {
          element.frame.map((el_frame) => {
            array.push({
              ...element,
              frame: el_frame,
              variants: el,
              id: element._id,
              path: join(`${element.code}`, `${findIndx.path}`, `${el_frame}`),
            });
          });
        }
      }
    }
    for (let j = 0; j < array.length; j++) {
      try {
        const url = `https://dev.api.3dily.com/scene/${panel}/${
          array[j]?.code
        }/image?shadow=${!!array[j]?.shadow}${
          array[j]?.frame ? `&frame=${array[j]?.frame}` : ''
        }&type=png${array[j]?.quality ? `&quality=${array[j]?.quality}` : ''}${
          array[j]?.size ? `&size=${array[j]?.size}` : ''
        }${array[j]?.crop ? `&crop=${array[j]?.crop}` : ''}${
          array[j]?.background ? `&background=${array[j]?.background}` : ''
        }${
          array[j]?.variants
            ? `&variants=${JSON.stringify(array[j]?.variants)}`
            : ''
        }`;
        const x = await this.httpService
          .get(url, { method: 'get', responseType: 'stream' })
          .toPromise();
        directory = join(dir, array[j].path);
        if (!existsSync(directory)) {
          console.log();
          mkdirSync(directory, { recursive: true });
        }
        x.data.pipe(createWriteStream(join(directory, 'x.png')));
      } catch (error) {
        console.log('Errror', error);
        Error.push({ message: error.message, id: array[j].id });
        if (existsSync(directory)) {
          rmSync(directory, { recursive: true, force: true });
        }
        bundle.products = bundle.products.map((el) => {
          if (el._id === array[j].id) {
            el.status = 'Failed';
          }
          return el;
        });
      }
    }
    this.errorHandleings(Error);

    bundle.products = bundle.products.map((el) => {
      Error.map((element) => {
        if (element.id === el._id) {
          el.errors.push(element.message);
        }
      });
      if (el.status !== 'Failed') el.status = 'Done';
      return el;
    });

    this.zipFile(dir, bundle._id);
    bundle.status = 'Done';
    console.log('bundle', bundle);
    return bundle;
  }

  varients(array, query) {
    let galleryIndex = 0;
    const error = [];
    array.forEach((layer, i) => {
      if (Object.keys(query).includes(layer.code)) {
        const index = layer.variants.indexOf(query[layer.code]);
        if (index > -1) {
          galleryIndex +=
            i === array.length - 1
              ? index
              : index *
                array
                  .slice(i + 1)
                  .map((layer) => layer.variants.length)
                  .reduce((a, b) => a + b, 0);
        } else {
          error.push('Error');
        }
      }
    });

    return { galleryIndex, error };
  }

  Dupilcate(array) {
    const result = [];
    array.map((d, indexx) => {
      const index = result.findIndex(
        (element) => element.path === d.path && element.code === d.code,
      );
      if (index === -1) {
        result.push(d);
      } else {
        result.push({
          ...d,
          path: d.path + '-v' + indexx,
        });
      }
    });
    return result;
  }

  errorHandleings(Error) {
    if (!existsSync('error.txt')) {
      writeFileSync('error.txt', JSON.stringify([]));
    }
    const data = readFileSync('error.txt');
    const logs = JSON.parse(data.toString());
    writeFileSync(
      'error.txt',
      JSON.stringify([...logs, ...Error.map((el) => el.message)]),
    );
  }

  zipFile(path: string, bundleId: string) {
    const newzip = new Zip();
    newzip.addLocalFolderAsync(join(path), () => {
      writeFile(
        join(process.env.DIR, 'bundles', `bundles-${bundleId}.zip`),
        newzip.toBuffer(),
        () => {
          rmSync(path, { recursive: true });
        },
      );
    });
  }
}
