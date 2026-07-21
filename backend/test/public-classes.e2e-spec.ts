import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { body, createTestApp, IdBody, registerFactory } from './utils';

interface ClassBody {
  id: string;
  isPublic: boolean;
}

describe('Public classes security (e2e)', () => {
  let app: INestApplication<App>;
  let register: ReturnType<typeof registerFactory>;
  const suffix = Date.now();

  beforeAll(async () => {
    app = await createTestApp();
    register = registerFactory(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  async function makeTeacher(label: string) {
    return register({
      email: `pc_teacher_${label}_${suffix}@test.dev`,
      password: 'password123',
      fullName: `Teacher ${label}`,
      role: 'TEACHER',
      tenantName: `Tenant PC ${label} ${suffix}`,
    });
  }

  async function makeStudent(label: string) {
    return register({
      email: `pc_student_${label}_${suffix}@test.dev`,
      password: 'password123',
      fullName: `Student ${label}`,
      role: 'STUDENT',
    });
  }

  it('1-2: only isPublic=true classes appear in /classes/public, private ones do not', async () => {
    const { accessToken: teacherToken } = await makeTeacher('a');
    const { accessToken: studentToken } = await makeStudent('a');

    const publicClassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Public class', isPublic: true })
      .expect(201);
    const publicClass = body<ClassBody>(publicClassRes);

    const privateClassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Private class' })
      .expect(201);
    const privateClass = body<ClassBody>(privateClassRes);

    const listRes = await request(server())
      .get('/classes/public')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    const list = body<ClassBody[]>(listRes);
    const ids = list.map((c) => c.id);

    expect(ids).toContain(publicClass.id);
    expect(ids).not.toContain(privateClass.id);
  });

  it('3: a student who already joined cannot join the same public class again', async () => {
    const { accessToken: teacherToken } = await makeTeacher('b');
    const { accessToken: studentToken } = await makeStudent('b');

    const klassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Join twice class', isPublic: true })
      .expect(201);
    const klass = body<IdBody>(klassRes);

    await request(server())
      .post(`/classes/${klass.id}/join-public`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(201);

    await request(server())
      .post(`/classes/${klass.id}/join-public`)
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(409);
  });

  it('4: an unauthenticated request cannot browse or join public classes', async () => {
    const { accessToken: teacherToken } = await makeTeacher('c');
    const klassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Unauth test class', isPublic: true })
      .expect(201);
    const klass = body<IdBody>(klassRes);

    await request(server()).get('/classes/public').expect(401);
    await request(server())
      .post(`/classes/${klass.id}/join-public`)
      .expect(401);
  });

  it('5-7: a teacher from another tenant cannot edit, disable, or delete a class they do not own', async () => {
    const { accessToken: ownerToken } = await makeTeacher('owner');
    const { accessToken: outsiderToken } = await makeTeacher('outsider');

    const klassRes = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Owned class', isPublic: true })
      .expect(201);
    const klass = body<IdBody>(klassRes);

    // Outsider teacher cannot rename it
    await request(server())
      .patch(`/classes/${klass.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Hijacked name' })
      .expect(403);

    // Outsider teacher cannot toggle isPublic off
    await request(server())
      .patch(`/classes/${klass.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ name: 'Owned class', isPublic: false })
      .expect(403);

    // Outsider teacher cannot delete it
    await request(server())
      .delete(`/classes/${klass.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(403);

    // Outsider's own class list must not include the owner's class (tenant scoping)
    const outsiderListRes = await request(server())
      .get('/classes')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(200);
    const outsiderList = body<IdBody[]>(outsiderListRes);
    expect(outsiderList.map((c) => c.id)).not.toContain(klass.id);
  });

  it('6: disabling isPublic or deleting a class removes it from the public listing', async () => {
    const { accessToken: teacherToken } = await makeTeacher('d');
    const { accessToken: studentToken } = await makeStudent('d');

    const class1Res = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Will be unpublished', isPublic: true })
      .expect(201);
    const class1 = body<IdBody>(class1Res);

    const class2Res = await request(server())
      .post('/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Will be deleted', isPublic: true })
      .expect(201);
    const class2 = body<IdBody>(class2Res);

    // Both currently public
    let listRes = await request(server())
      .get('/classes/public')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    let ids = body<IdBody[]>(listRes).map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining([class1.id, class2.id]));

    // Owner disables isPublic on class1
    await request(server())
      .patch(`/classes/${class1.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Will be unpublished', isPublic: false })
      .expect(200);

    // Owner deletes class2
    await request(server())
      .delete(`/classes/${class2.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    listRes = await request(server())
      .get('/classes/public')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    ids = body<IdBody[]>(listRes).map((c) => c.id);
    expect(ids).not.toContain(class1.id);
    expect(ids).not.toContain(class2.id);
  });
});
