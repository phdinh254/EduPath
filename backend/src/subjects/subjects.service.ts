import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateTopicDto } from './dto/create-topic.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.subject.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFoundException('Không tìm thấy môn học');
    }
    return subject;
  }

  create(dto: CreateSubjectDto) {
    return this.prisma.subject.create({ data: dto });
  }

  findTopics(subjectId: string) {
    return this.prisma.topic.findMany({ where: { subjectId }, orderBy: { name: 'asc' } });
  }

  async createTopic(subjectId: string, dto: CreateTopicDto) {
    await this.findOne(subjectId);
    return this.prisma.topic.create({
      data: { subjectId, name: dto.name, parentTopicId: dto.parentTopicId },
    });
  }
}
