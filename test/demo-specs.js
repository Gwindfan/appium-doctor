// transpile:mocha

import { DirCheck, FileCheck } from '../lib/demo';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';
import { fs } from '../lib/utils';
import * as tp from 'teen_process';
import * as prompt from '../lib/prompt';
import { FixSkippedError } from '../lib/doctor';
import { withMocks, verifyAll, getSandbox } from './mock-utils';
import { newLogStub } from './log-utils.js';

chai.should();
chai.use(chaiAsPromised);
let P = Promise;

describe('demo', () => {
  describe('DirCheck', withMocks({fs}, (mocks) => {
    let check = new DirCheck('/a/b/c/d');

    it('diagnose - success', async () => {
      mocks.fs.expects('exists').once().returns(P.resolve(true));
      mocks.fs.expects('lstat').once().returns(
        P.resolve({isDirectory: () => { return true; }}));
      (await check.diagnose()).should.deep.equal(
        { ok: true, message: 'Found directory at: /a/b/c/d' });
      verifyAll(mocks);
    });

    it('failure - not there', async () => {
      mocks.fs.expects('exists').once().returns(P.resolve(false));
      (await check.diagnose()).should.deep.equal(
        { ok: false, message: 'Could NOT find directory at \'/a/b/c/d\'!' });
      verifyAll(mocks);
    });

    it('failure - not a dir', async () => {
      mocks.fs.expects('exists').once().returns(P.resolve(true));
      mocks.fs.expects('lstat').once().returns(
        P.resolve({isDirectory: () => { return false; }}));
      (await check.diagnose()).should.deep.equal(
        { ok: false, message: '\'/a/b/c/d\' is NOT a directory!' });
      verifyAll(mocks);
    });

    it('fix', async () => {
      (await check.fix()).should.equal('Manually create a directory at: /a/b/c/d');
    });
  }));

  describe('FileCheck', withMocks({fs, tp, prompt}, (mocks) => {
    let check = new FileCheck('/a/b/c/d');

    it('diagnose - success', async () => {
      mocks.fs.expects('exists').once().returns(P.resolve(true));
      (await check.diagnose()).should.deep.equal(
        { ok: true, message: 'Found file at: /a/b/c/d' });
      verifyAll(mocks);
    });

    it('failure - not there', async () => {
      mocks.fs.expects('exists').once().returns(P.resolve(false));
      (await check.diagnose()).should.deep.equal(
        { ok: false, message: 'Could NOT find file at \'/a/b/c/d\'!' });
      verifyAll(mocks);
    });

    it('fix - yes', async () => {
      let logStub = newLogStub(getSandbox(mocks), {stripColors: true});
      mocks.prompt.expects('fixIt').once().returns(P.resolve('yes'));
      mocks.tp.expects('exec').once().returns(
        P.resolve({stdout: '', stderr: ''}));
      (await check.fix());
      verifyAll(mocks);
      logStub.output.should.equal('info: The following command need be executed: touch \'/a/b/c/d\'');
    });

    it('fix - no', async () => {
      let logStub = newLogStub(getSandbox(mocks), {stripColors: true});
      mocks.prompt.expects('fixIt').once().returns(P.resolve('no'));
      mocks.tp.expects('exec').never();
      await check.fix().should.be.rejectedWith(FixSkippedError);
      verifyAll(mocks);
      logStub.output.should.equal([
        'info: The following command need be executed: touch \'/a/b/c/d\'',
        'info: Skipping you will need to touch \'/a/b/c/d\' manually.'
      ].join('\n'));
    });
  }));
});
