import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiResponse,
} from 'api-catalog/nestjs';
import { s } from 'api-catalog/spec';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

// In-memory store — replace with your service / database layer
let store: User[] = [
  { id: '1', name: 'Alice',   email: 'alice@example.com', role: 'admin' },
  { id: '2', name: 'Bob',     email: 'bob@example.com',   role: 'user'  },
  { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'user' },
];

@Controller('users')
export class UsersController {

  // ── GET /users ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List users', tags: ['Users'] })
  @ApiQuery({ name: 'limit',  schema: s.integer({ minimum: 1, maximum: 100 }), required: false })
  @ApiQuery({ name: 'offset', schema: s.integer({ minimum: 0 }),               required: false })
  @ApiQuery({ name: 'role',   schema: s.enum(['admin', 'user']),                required: false })
  @ApiResponse({ status: 200, description: 'Paginated user list', schema: s.array(s.ref('User')) })
  findAll(
    @Query('limit')  limit  = 20,
    @Query('offset') offset = 0,
    @Query('role')   role?: string,
  ) {
    let result = store;
    if (role) result = result.filter(u => u.role === role);
    return result.slice(Number(offset), Number(offset) + Number(limit));
  }

  // ── POST /users ─────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create user', tags: ['Users'] })
  @ApiBody({
    schema: s.object(
      {
        name:  s.string(),
        email: s.string({ format: 'email' }),
        role:  s.enum(['admin', 'user']),
      },
      ['name', 'email'],
    ),
  })
  @ApiResponse({ status: 201, description: 'User created',     schema: s.ref('User') })
  @ApiResponse({ status: 422, description: 'Validation error' })
  create(@Body() body: Omit<User, 'id'>) {
    const user: User = {
      id:   String(store.length + 1),
      role: 'user',
      ...body,
    };
    store.push(user);
    return user;
  }

  // ── GET /users/:id ──────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID', tags: ['Users'] })
  @ApiParam({ name: 'id', schema: s.string({ format: 'uuid' }) })
  @ApiResponse({ status: 200, description: 'User found', schema: s.ref('User') })
  @ApiResponse({ status: 404, description: 'Not found'   })
  findOne(@Param('id') id: string) {
    return store.find(u => u.id === id) ?? null;
  }

  // ── PATCH /users/:id ────────────────────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Update user', tags: ['Users'] })
  @ApiParam({ name: 'id', schema: s.string({ format: 'uuid' }) })
  @ApiBody({
    schema: s.object({
      name:  s.string(),
      email: s.string({ format: 'email' }),
      role:  s.enum(['admin', 'user']),
    }),
  })
  @ApiResponse({ status: 200, description: 'User updated', schema: s.ref('User') })
  @ApiResponse({ status: 404, description: 'Not found'    })
  update(@Param('id') id: string, @Body() body: Partial<Omit<User, 'id'>>) {
    const idx = store.findIndex(u => u.id === id);
    if (idx === -1) return null;
    store[idx] = { ...store[idx], ...body };
    return store[idx];
  }

  // ── DELETE /users/:id ───────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user', tags: ['Users'] })
  @ApiParam({ name: 'id', schema: s.string({ format: 'uuid' }) })
  @ApiResponse({ status: 200, description: 'User deleted', schema: s.ref('User') })
  @ApiResponse({ status: 404, description: 'Not found'    })
  remove(@Param('id') id: string) {
    const idx = store.findIndex(u => u.id === id);
    if (idx === -1) return null;
    return store.splice(idx, 1)[0];
  }
}
